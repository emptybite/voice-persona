from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response

from .clients import HttpServiceClient
from .config import settings
from .models import (
    ChatRequest,
    ChatResponse,
    EndpointHealth,
    HealthResponse,
    MemoryMessage,
    PersonalityProfile,
    SpeakRequest,
    TranscribeResponse,
    UpsertProfileRequest,
)
from .storage import JsonStore

app = FastAPI(title="Voice Chatbot Orchestrator", version="0.1.0")
store = JsonStore(settings.data_file)
lm_client = HttpServiceClient(settings.lm_studio_base_url, settings.request_timeout_seconds)
whisper_client = HttpServiceClient(settings.whisper_base_url, settings.request_timeout_seconds)
qwen_tts_client = HttpServiceClient(settings.qwen_tts_base_url, settings.request_timeout_seconds)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        lm_studio=EndpointHealth(
            service="lm_studio",
            base_url=settings.lm_studio_base_url,
            endpoint=settings.lm_studio_chat_endpoint,
        ),
        whisper=EndpointHealth(
            service="whisper",
            base_url=settings.whisper_base_url,
            endpoint=settings.whisper_transcribe_endpoint,
        ),
        qwen_tts=EndpointHealth(
            service="qwen_tts",
            base_url=settings.qwen_tts_base_url,
            endpoint=settings.qwen_tts_speak_endpoint,
        ),
    )


@app.get("/v1/profiles", response_model=list[PersonalityProfile])
async def list_profiles() -> list[PersonalityProfile]:
    return store.list_profiles()


@app.post("/v1/profiles", response_model=PersonalityProfile)
async def upsert_profile(req: UpsertProfileRequest) -> PersonalityProfile:
    existing = store.get_profile(req.id) if req.id else None
    now = datetime.now(timezone.utc)

    payload = {
        "name": req.name,
        "system_prompt": req.system_prompt,
        "voice": req.voice,
        "created_at": existing.created_at if existing else now,
        "updated_at": now,
    }
    if req.id:
        payload["id"] = req.id

    profile = PersonalityProfile(
        **payload,
    )
    return store.upsert_profile(profile)


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    profile = store.get_profile(req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")

    history = store.get_messages(req.session_id, req.profile_id, req.max_history_messages)
    messages = [{"role": "system", "content": profile.system_prompt}] + [
        {"role": m.role, "content": m.content} for m in history
    ]
    messages.append({"role": "user", "content": req.user_message})

    payload = {
        "model": settings.lm_studio_model,
        "messages": messages,
        "temperature": req.temperature,
    }

    try:
        llm_response = await lm_client.post_json(settings.lm_studio_chat_endpoint, payload)
        assistant_message = llm_response["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LM Studio request failed: {exc}") from exc

    store.append_message(req.session_id, req.profile_id, MemoryMessage(role="user", content=req.user_message))
    store.append_message(req.session_id, req.profile_id, MemoryMessage(role="assistant", content=assistant_message))

    return ChatResponse(
        session_id=req.session_id,
        profile_id=req.profile_id,
        assistant_message=assistant_message,
    )


@app.post("/v1/audio/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)) -> TranscribeResponse:
    content = await file.read()
    files = {"file": (file.filename, content, file.content_type or "audio/wav")}
    data = {"model": "whisper-1"}
    try:
        result = await whisper_client.post_multipart(settings.whisper_transcribe_endpoint, files, data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Whisper request failed: {exc}") from exc

    text = result.get("text") or result.get("transcript") or ""
    return TranscribeResponse(text=text)


@app.post("/v1/audio/speak")
async def speak(req: SpeakRequest) -> Response:
    profile = store.get_profile(req.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")

    payload = {
        "model": "qwen-tts",
        "input": req.text,
        "voice": profile.voice.voice,
        "format": req.format,
        "extra_prompt": profile.voice.tone_prompt,
        "speed": profile.voice.speed,
    }

    try:
        audio = await qwen_tts_client.post_bytes(settings.qwen_tts_speak_endpoint, payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Qwen TTS request failed: {exc}") from exc

    media_type = "audio/mpeg" if req.format == "mp3" else "audio/wav"
    return Response(content=audio, media_type=media_type)
