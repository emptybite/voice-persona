from __future__ import annotations

import asyncio
import os
import math
import struct
import tempfile
import wave
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .config import settings

router = APIRouter()


class LocalSpeakRequest(BaseModel):
    model: str = "elevenlabs"
    input: str
    voice: str = "default"
    format: str = Field(default="wav")
    extra_prompt: str | None = None
    speed: float = 1.0


@lru_cache(maxsize=1)
def _load_whisper_model():
    try:
        import whisper
    except ImportError as exc:  # pragma: no cover - import failure depends on environment
        raise RuntimeError("openai-whisper is not installed in this environment.") from exc

    return whisper.load_model(settings.whisper_local_model)


def transcribe_audio_bytes(content: bytes, filename: str | None = None) -> str:
    suffix = Path(filename or "audio.wav").suffix or ".wav"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        whisper_model = _load_whisper_model()
        result = whisper_model.transcribe(temp_path, fp16=False)
        text = (result or {}).get("text", "").strip()
        if not text:
            raise HTTPException(
                status_code=422,
                detail="Whisper transcription was empty. Try speaking louder/longer or use clearer audio.",
            )
        return text
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=500,
            detail=f"Local Whisper transcription failed. Ensure ffmpeg is installed and model '{settings.whisper_local_model}' is available. Error: {exc}",
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _build_wav_tone(duration_seconds: float = 0.8, sample_rate: int = 22050) -> bytes:
    frame_count = int(duration_seconds * sample_rate)
    amplitude = 13000
    freq_hz = 440

    buffer = BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for i in range(frame_count):
            sample = int(amplitude * math.sin(2.0 * math.pi * freq_hz * (i / sample_rate)))
            wav_file.writeframes(struct.pack("<h", sample))
    return buffer.getvalue()


@router.post("/_local/whisper/v1/audio/transcriptions")
async def local_transcribe(file: UploadFile = File(...), model: str = "whisper-1") -> dict[str, str]:
    _ = model
    content = await file.read()
    text = await asyncio.to_thread(transcribe_audio_bytes, content, file.filename)
    return {"text": text}


@router.post("/_local/tts/v1/audio/speech")
async def local_speak(req: LocalSpeakRequest) -> Response:
    if req.format not in {"wav", "mp3"}:
        raise HTTPException(status_code=400, detail="format must be 'wav' or 'mp3'")

    if req.format == "mp3":
        raise HTTPException(
            status_code=501,
            detail="Local TTS stub currently supports wav output only. Use format='wav' or configure an external TTS service.",
        )

    duration = min(2.5, max(0.2, len(req.input) / 30.0))
    audio = _build_wav_tone(duration_seconds=duration)
    return Response(content=audio, media_type="audio/wav")
