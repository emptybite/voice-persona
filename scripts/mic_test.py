from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
import time
import uuid
import wave
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import httpx
import numpy as np
import sounddevice as sd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Record mic audio and run transcribe -> chat -> speak.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="Base URL for this FastAPI backend.")
    parser.add_argument("--duration", type=float, default=5.0, help="Mic recording duration in seconds.")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Audio sample rate.")
    parser.add_argument("--profile-name", default="main", help="Profile name to upsert.")
    parser.add_argument("--session-id", default=f"mic-{uuid.uuid4().hex[:8]}", help="Session id for chat memory.")
    parser.add_argument(
        "--system-prompt",
        default="You are concise and helpful.",
        help="System prompt for the temporary profile.",
    )
    parser.add_argument("--voice", default="21m00Tcm4TlvDq8ikWAM", help="ElevenLabs voice_id for /v1/audio/speak.")
    parser.add_argument("--speed", type=float, default=1.0, help="Voice speed.")
    parser.add_argument(
        "--tts-mode",
        choices=("stream", "http"),
        default="stream",
        help="Use websocket streaming TTS or classic HTTP /v1/audio/speak.",
    )
    parser.add_argument("--ws-path", default="/ws/tts", help="WebSocket path for streaming TTS.")
    parser.add_argument("--timeout", type=float, default=180.0, help="Per-request timeout in seconds.")
    parser.add_argument("--output", default="mic_reply.wav", help="Where to save generated speech WAV.")
    parser.add_argument("--play", action="store_true", help="Play generated WAV after synthesis (Windows).")
    return parser.parse_args()


def record_wav_bytes(duration: float, sample_rate: int) -> bytes:
    frames = int(duration * sample_rate)
    print(f"Recording {duration:.1f}s from default microphone...")
    audio = sd.rec(frames, samplerate=sample_rate, channels=1, dtype="float32")
    sd.wait()
    audio_int16 = np.clip(audio * 32767.0, -32768, 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())
    return buf.getvalue()


def approx_tokens(text: str) -> int:
    return len(re.findall(r"\w+|[^\w\s]", text))


def safe_div(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def wav_duration_seconds(wav_bytes: bytes) -> float:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        frames = wav_file.getnframes()
        rate = wav_file.getframerate()
    return safe_div(float(frames), float(rate))


def combine_wav_chunks(chunks: list[bytes]) -> bytes:
    if not chunks:
        raise RuntimeError("No audio chunks received from websocket stream.")

    params: tuple[int, int, int, str, str] | None = None
    all_frames: list[bytes] = []
    for chunk in chunks:
        with wave.open(io.BytesIO(chunk), "rb") as wav_file:
            chunk_params = (
                wav_file.getnchannels(),
                wav_file.getsampwidth(),
                wav_file.getframerate(),
                wav_file.getcomptype(),
                wav_file.getcompname(),
            )
            if params is None:
                params = chunk_params
            elif params != chunk_params:
                raise RuntimeError("Streaming chunks returned inconsistent WAV formats.")
            all_frames.append(wav_file.readframes(wav_file.getnframes()))

    assert params is not None
    out = io.BytesIO()
    with wave.open(out, "wb") as wav_file:
        wav_file.setnchannels(params[0])
        wav_file.setsampwidth(params[1])
        wav_file.setframerate(params[2])
        wav_file.setcomptype(params[3], params[4])
        wav_file.writeframes(b"".join(all_frames))
    return out.getvalue()


def to_ws_url(api_base: str, ws_path: str) -> str:
    parsed = urlparse(api_base.rstrip("/"))
    if parsed.scheme not in {"http", "https", "ws", "wss"}:
        raise ValueError(f"Unsupported --api-base scheme for websocket conversion: {parsed.scheme}")
    scheme = "wss" if parsed.scheme in {"https", "wss"} else "ws"
    base_path = parsed.path.rstrip("/")
    # Common case: users pass an OpenAI-style base like http://host:port/v1.
    # The websocket route in this app lives at /ws/tts, not /v1/ws/tts.
    if base_path.lower() == "/v1":
        base_path = ""
    ws_suffix = ws_path if ws_path.startswith("/") else f"/{ws_path}"
    full_path = f"{base_path}{ws_suffix}" or "/"
    return urlunparse((scheme, parsed.netloc, full_path, "", "", ""))


def candidate_ws_urls(api_base: str, ws_path: str) -> list[str]:
    primary = to_ws_url(api_base, ws_path)
    parsed = urlparse(primary)
    path = parsed.path or "/"

    candidates = [primary]
    if not path.startswith("/v1/") and path != "/v1":
        alt_path = f"/v1{path if path.startswith('/') else '/' + path}"
        alt = urlunparse((parsed.scheme, parsed.netloc, alt_path, "", "", ""))
        if alt not in candidates:
            candidates.append(alt)
    return candidates


def ws_status_code(exc: Exception) -> int | None:
    response = getattr(exc, "response", None)
    if response is None:
        return None
    code = getattr(response, "status_code", None)
    return code if isinstance(code, int) else None


def tts_stream_wav(
    *,
    api_base: str,
    ws_path: str,
    profile_id: str,
    text: str,
    timeout_seconds: float,
) -> tuple[bytes, dict[str, float | int]]:
    try:
        from websockets.sync.client import connect
        from websockets.exceptions import InvalidStatus
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("websockets package is required for --tts-mode stream.") from exc

    last_error: Exception | None = None
    attempted: list[str] = []
    for ws_url in candidate_ws_urls(api_base, ws_path):
        attempted.append(ws_url)
        chunks: list[bytes] = []
        expected_chunks = 0
        first_chunk_latency_s: float | None = None
        t0 = time.perf_counter()
        try:
            with connect(ws_url, open_timeout=timeout_seconds, close_timeout=5, max_size=64 * 1024 * 1024) as ws:
                ws.send(json.dumps({"profile_id": profile_id, "text": text}))
                while True:
                    message = ws.recv(timeout=timeout_seconds)
                    now = time.perf_counter()
                    if isinstance(message, bytes):
                        message = message.decode("utf-8", errors="replace")
                    event = json.loads(message)
                    event_type = event.get("type")
                    if event_type == "start":
                        expected_chunks = int(event.get("chunks") or 0)
                        continue
                    if event_type == "audio_chunk":
                        if first_chunk_latency_s is None:
                            first_chunk_latency_s = now - t0
                        audio_b64 = str(event.get("audio_b64") or "")
                        if not audio_b64:
                            raise RuntimeError("Received audio_chunk without audio_b64.")
                        chunks.append(base64.b64decode(audio_b64))
                        continue
                    if event_type == "done":
                        break
                    if event_type == "error":
                        raise RuntimeError(f"WS TTS error: {event.get('detail')}")
                    raise RuntimeError(f"Unexpected WS event: {event}")

            elapsed_s = time.perf_counter() - t0
            merged_wav = combine_wav_chunks(chunks)
            metrics: dict[str, float | int] = {
                "elapsed_s": elapsed_s,
                "first_chunk_latency_s": 0.0 if first_chunk_latency_s is None else first_chunk_latency_s,
                "received_chunks": len(chunks),
                "expected_chunks": expected_chunks,
                "ws_url": ws_url,
            }
            return merged_wav, metrics
        except InvalidStatus as exc:
            last_error = exc
            if ws_status_code(exc) == 404:
                continue
            raise RuntimeError(f"WebSocket failed at {ws_url}: {exc}") from exc
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"WebSocket failed at {ws_url}: {exc}") from exc

    if last_error is not None:
        raise RuntimeError(
            "WebSocket TTS route not found (HTTP 404) on attempted paths: "
            + ", ".join(attempted)
        ) from last_error
    raise RuntimeError("WebSocket TTS failed before connecting.")


def tts_http_wav(client: httpx.Client, api_base: str, profile_id: str, text: str) -> tuple[bytes, float]:
    speak_payload = {"profile_id": profile_id, "text": text, "format": "wav"}
    t0 = time.perf_counter()
    speak_resp = client.post(f"{api_base}/v1/audio/speak", json=speak_payload)
    elapsed_s = time.perf_counter() - t0
    speak_resp.raise_for_status()
    content_type = speak_resp.headers.get("content-type", "")
    if not content_type.startswith("audio/"):
        body = speak_resp.text[:300]
        raise RuntimeError(f"TTS did not return audio. content-type={content_type} body={body}")
    return speak_resp.content, elapsed_s


def main() -> int:
    args = parse_args()
    run_start = time.perf_counter()
    wav_bytes = record_wav_bytes(args.duration, args.sample_rate)

    profile_payload = {
        "name": args.profile_name,
        "system_prompt": args.system_prompt,
        "voice": {"voice": args.voice, "tone_prompt": "Clear and natural.", "speed": args.speed},
    }

    try:
        with httpx.Client(timeout=args.timeout) as client:
            t_profile = time.perf_counter()
            profile_resp = client.post(f"{args.api_base}/v1/profiles", json=profile_payload)
            profile_resp.raise_for_status()
            profile_seconds = time.perf_counter() - t_profile
            profile_id = profile_resp.json()["id"]

            files = {"file": ("mic.wav", wav_bytes, "audio/wav")}
            t_whisper = time.perf_counter()
            transcribe_resp = client.post(f"{args.api_base}/v1/audio/transcribe", files=files)
            transcribe_resp.raise_for_status()
            whisper_seconds = time.perf_counter() - t_whisper
            user_text = transcribe_resp.json().get("text", "").strip()
            print(f"Transcription: {user_text}")
            if not user_text:
                print("Transcription was empty.")
                return 1
            if user_text.lower().startswith("local whisper stub transcription"):
                print(
                    "Warning: STT is returning stub text. Set AI_BOT_WHISPER_BASE_URL to this app (for example http://127.0.0.1:8020) and restart server."
                )

            chat_payload = {
                "profile_id": profile_id,
                "session_id": args.session_id,
                "user_message": user_text,
                "temperature": 0.2,
            }
            t_lm = time.perf_counter()
            chat_resp = client.post(f"{args.api_base}/v1/chat", json=chat_payload)
            chat_resp.raise_for_status()
            lm_seconds = time.perf_counter() - t_lm
            chat_json = chat_resp.json()
            assistant_text = str(chat_json.get("assistant_message", "")).strip()
            print(f"Assistant: {assistant_text}")
            if not assistant_text:
                print("Chat reply was empty.")
                return 1

            ws_metrics: dict[str, float | int] = {}
            if args.tts_mode == "stream":
                try:
                    tts_bytes, ws_metrics = tts_stream_wav(
                        api_base=args.api_base,
                        ws_path=args.ws_path,
                        profile_id=profile_id,
                        text=assistant_text,
                        timeout_seconds=args.timeout,
                    )
                    tts_seconds = float(ws_metrics.get("elapsed_s", 0.0))
                except Exception as exc:  # noqa: BLE001
                    msg = str(exc)
                    if "HTTP 404" not in msg:
                        raise
                    print(f"Streaming TTS unavailable ({msg}). Falling back to HTTP /v1/audio/speak.")
                    tts_bytes, tts_seconds = tts_http_wav(client, args.api_base, profile_id, assistant_text)
                    ws_metrics = {"fallback": 1}
            else:
                tts_bytes, tts_seconds = tts_http_wav(client, args.api_base, profile_id, assistant_text)

            output_path = Path(args.output)
            output_path.write_bytes(tts_bytes)
            print(f"Saved synthesized audio to: {output_path.resolve()}")

            usage = chat_json.get("usage") if isinstance(chat_json.get("usage"), dict) else {}
            completion_tokens = usage.get("completion_tokens")
            if not isinstance(completion_tokens, int) or completion_tokens <= 0:
                completion_tokens = approx_tokens(assistant_text)
                completion_source = "estimated"
            else:
                completion_source = "lm_usage"

            prompt_tokens = usage.get("prompt_tokens")
            if not isinstance(prompt_tokens, int) or prompt_tokens <= 0:
                prompt_tokens = approx_tokens(user_text)
                prompt_source = "estimated"
            else:
                prompt_source = "lm_usage"

            tts_input_tokens = approx_tokens(assistant_text)
            output_audio_seconds = wav_duration_seconds(tts_bytes)
            total_seconds = time.perf_counter() - run_start
            print("")
            print("Performance")
            print(f"  Profile upsert: {profile_seconds:.2f}s")
            print(
                f"  Whisper STT: {whisper_seconds:.2f}s | input_audio={args.duration:.2f}s | RTF={safe_div(whisper_seconds, args.duration):.2f}"
            )
            print(
                f"  LM Studio: {lm_seconds:.2f}s | prompt_tokens={prompt_tokens} ({prompt_source}) | completion_tokens={completion_tokens} ({completion_source}) | completion_tok/s={safe_div(float(completion_tokens), lm_seconds):.2f}"
            )
            print(
                f"  TTS ({args.tts_mode}): {tts_seconds:.2f}s | input_tokens~{tts_input_tokens} | input_tok/s~{safe_div(float(tts_input_tokens), tts_seconds):.2f} | output_audio={output_audio_seconds:.2f}s | RTF={safe_div(tts_seconds, output_audio_seconds):.2f}"
            )
            if args.tts_mode == "stream":
                if int(ws_metrics.get("fallback", 0)) == 1:
                    print("  TTS stream: unavailable on server; used HTTP fallback")
                else:
                    print(
                        f"  TTS stream: ws={ws_metrics.get('ws_url', '?')} | first_chunk={float(ws_metrics.get('first_chunk_latency_s', 0.0)):.2f}s | chunks={int(ws_metrics.get('received_chunks', 0))}/{int(ws_metrics.get('expected_chunks', 0))}"
                    )
            print(f"  End-to-end: {total_seconds:.2f}s")
    except Exception as exc:  # noqa: BLE001
        print(f"Mic test failed: {exc}")
        return 1

    if args.play:
        try:
            import winsound

            winsound.PlaySound(str(Path(args.output).resolve()), winsound.SND_FILENAME)
        except Exception as exc:  # noqa: BLE001
            print(f"Could not play audio automatically: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
