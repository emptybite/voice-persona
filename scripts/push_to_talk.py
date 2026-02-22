from __future__ import annotations

import argparse
import io
import math
import msvcrt
import time
import uuid
import wave
from pathlib import Path

import httpx
import numpy as np
import sounddevice as sd
import soundfile as sf


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Push-to-talk loop: press Space, speak, auto-stop on silence, then transcribe->chat->speak."
    )
    parser.add_argument("--api-base", default="http://127.0.0.1:8020", help="Backend base URL.")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Mic sample rate.")
    parser.add_argument("--channels", type=int, default=1, help="Mic channels.")
    parser.add_argument("--silence-seconds", type=float, default=1.2, help="Stop after this much trailing silence.")
    parser.add_argument("--vad-threshold", type=float, default=0.010, help="RMS threshold for voice activity.")
    parser.add_argument("--max-seconds", type=float, default=12.0, help="Max capture duration per utterance.")
    parser.add_argument("--profile-name", default="main", help="Profile name to create/use.")
    parser.add_argument("--voice", default="JBFqnCBsd6RMkjVDRZzb", help="ElevenLabs voice_id for profile/request.")
    parser.add_argument(
        "--tts-model",
        default="",
        help="Optional ElevenLabs model id (for example: eleven_turbo_v2_5 or eleven_multilingual_v2).",
    )
    parser.add_argument("--system-prompt", default="You are concise and helpful.", help="System prompt.")
    parser.add_argument("--session-id", default=f"ptt-{uuid.uuid4().hex[:8]}", help="Session id.")
    parser.add_argument("--save-last", default="last_reply.wav", help="Save latest reply wav path.")
    return parser.parse_args()


def wav_bytes_from_pcm(audio: np.ndarray, sample_rate: int) -> bytes:
    pcm = np.clip(audio * 32767.0, -32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())
    return buf.getvalue()


def rms_level(chunk: np.ndarray) -> float:
    if chunk.size == 0:
        return 0.0
    return float(math.sqrt(float(np.mean(np.square(chunk)))))


def record_until_silence(
    sample_rate: int,
    channels: int,
    silence_seconds: float,
    vad_threshold: float,
    max_seconds: float,
) -> np.ndarray | None:
    frames_per_chunk = int(sample_rate * 0.05)  # 50ms
    chunks: list[np.ndarray] = []
    heard_voice = False
    start = time.monotonic()
    last_voice = start

    with sd.InputStream(samplerate=sample_rate, channels=channels, dtype="float32") as stream:
        while True:
            data, overflowed = stream.read(frames_per_chunk)
            if overflowed:
                pass
            mono = data[:, 0] if data.ndim > 1 else data
            chunks.append(mono.copy())

            now = time.monotonic()
            level = rms_level(mono)
            if level >= vad_threshold:
                heard_voice = True
                last_voice = now

            if heard_voice and (now - last_voice) >= silence_seconds:
                break
            if (now - start) >= max_seconds:
                break

    if not chunks:
        return None
    audio = np.concatenate(chunks).astype(np.float32)
    if not heard_voice:
        return None
    return audio


def ensure_profile(client: httpx.Client, api_base: str, profile_name: str, system_prompt: str, voice: str) -> str:
    existing = client.get(f"{api_base}/v1/profiles", timeout=30).json()
    for profile in existing:
        if profile.get("name") == profile_name:
            # Always refresh voice/prompt for existing profile so stale legacy voices do not break ElevenLabs.
            payload = {
                "id": profile.get("id"),
                "name": profile_name,
                "system_prompt": system_prompt,
                "voice": {"voice": voice, "tone_prompt": "Clear and natural.", "speed": 1.0},
            }
            updated = client.post(f"{api_base}/v1/profiles", json=payload, timeout=30)
            updated.raise_for_status()
            return str(updated.json()["id"])

    payload = {
        "name": profile_name,
        "system_prompt": system_prompt,
        "voice": {"voice": voice, "tone_prompt": "Clear and natural.", "speed": 1.0},
    }
    created = client.post(f"{api_base}/v1/profiles", json=payload, timeout=30)
    created.raise_for_status()
    return str(created.json()["id"])


def run_round(
    client: httpx.Client,
    api_base: str,
    profile_id: str,
    session_id: str,
    wav_bytes: bytes,
    save_last: Path,
    tts_model: str | None = None,
    voice_id: str | None = None,
) -> None:
    transcribe = client.post(
        f"{api_base}/v1/audio/transcribe",
        files={"file": ("mic.wav", wav_bytes, "audio/wav")},
        timeout=180,
    )
    transcribe.raise_for_status()
    user_text = transcribe.json().get("text", "").strip()
    if not user_text:
        print("No transcription.")
        return
    print(f"You: {user_text}")

    chat = client.post(
        f"{api_base}/v1/chat",
        json={
            "profile_id": profile_id,
            "session_id": session_id,
            "user_message": user_text,
            "temperature": 0.2,
        },
        timeout=180,
    )
    chat.raise_for_status()
    assistant = chat.json().get("assistant_message", "").strip()
    if not assistant:
        print("No assistant response.")
        return
    print(f"Assistant: {assistant}")

    speak = client.post(
        f"{api_base}/v1/audio/speak",
        json={
            "profile_id": profile_id,
            "text": assistant,
            "format": "wav",
            "tts_model": (tts_model or None),
            "voice_id": (voice_id or None),
        },
        timeout=300,
    )
    speak.raise_for_status()

    content_type = speak.headers.get("content-type", "")
    if not content_type.startswith("audio/"):
        print(f"TTS returned non-audio: {content_type} {speak.text[:300]}")
        return

    save_last.write_bytes(speak.content)
    wav, sr = sf.read(io.BytesIO(speak.content), dtype="float32")
    sd.play(wav, sr)
    sd.wait()


def main() -> int:
    args = parse_args()
    save_last = Path(args.save_last)

    print("Push-to-talk ready.")
    print("Press Space to talk. Press Q or Esc to quit.")

    with httpx.Client(timeout=120.0) as client:
        try:
            profile_id = ensure_profile(client, args.api_base, args.profile_name, args.system_prompt, args.voice)
        except Exception as exc:  # noqa: BLE001
            print(f"Failed to initialize profile: {exc}")
            return 1

        while True:
            key = msvcrt.getwch()
            if key in {"q", "Q", "\x1b"}:
                print("Exiting.")
                return 0
            if key != " ":
                continue

            print("Listening...")
            audio = record_until_silence(
                sample_rate=args.sample_rate,
                channels=args.channels,
                silence_seconds=args.silence_seconds,
                vad_threshold=args.vad_threshold,
                max_seconds=args.max_seconds,
            )
            if audio is None:
                print("No voice detected. Try again.")
                continue

            wav_bytes = wav_bytes_from_pcm(audio, args.sample_rate)
            try:
                run_round(
                    client=client,
                    api_base=args.api_base,
                    profile_id=profile_id,
                    session_id=args.session_id,
                    wav_bytes=wav_bytes,
                    save_last=save_last,
                    tts_model=args.tts_model.strip() or None,
                    voice_id=args.voice.strip() or None,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"Round failed: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
