from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class VoiceConfig(BaseModel):
    voice: str = Field(default="default")
    tone_prompt: str = Field(default="Speak clearly and naturally.")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class PersonalityProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    system_prompt: str
    voice: VoiceConfig = Field(default_factory=VoiceConfig)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    profile_id: str
    session_id: str
    user_message: str
    max_history_messages: int = Field(default=12, ge=2, le=50)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    session_id: str
    profile_id: str
    assistant_message: str


class MemoryMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UpsertProfileRequest(BaseModel):
    id: str | None = None
    name: str
    system_prompt: str
    voice: VoiceConfig = Field(default_factory=VoiceConfig)


class TranscribeResponse(BaseModel):
    text: str


class SpeakRequest(BaseModel):
    profile_id: str
    text: str
    format: Literal["mp3", "wav"] = "mp3"


class EndpointHealth(BaseModel):
    service: str
    base_url: str
    endpoint: str
    configured: bool = True


class HealthResponse(BaseModel):
    lm_studio: EndpointHealth
    whisper: EndpointHealth
    qwen_tts: EndpointHealth
