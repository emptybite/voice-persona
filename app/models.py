from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class VoiceConfig(BaseModel):
    voice: str = Field(default="default")
    tone_prompt: str = Field(default="Speak clearly and naturally.")
    language: str = Field(default="Auto")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class PersonalityProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    system_prompt: str
    avatar_url: str | None = None
    voice: VoiceConfig = Field(default_factory=VoiceConfig)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    profile_id: str
    session_id: str
    user_message: str
    tts_model: str | None = None
    max_history_messages: int = Field(default=12, ge=2, le=50)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    session_id: str
    profile_id: str
    assistant_message: str
    usage: dict[str, int] | None = None


class MemoryMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UpsertProfileRequest(BaseModel):
    id: str | None = None
    name: str
    system_prompt: str
    avatar_url: str | None = None
    voice: VoiceConfig = Field(default_factory=VoiceConfig)


class TranscribeResponse(BaseModel):
    text: str


class SpeakRequest(BaseModel):
    profile_id: str
    text: str
    format: Literal["mp3", "wav"] = "wav"
    tts_model: str | None = None
    voice_id: str | None = None


class EndpointHealth(BaseModel):
    service: str
    base_url: str
    endpoint: str
    configured: bool = True


class HealthResponse(BaseModel):
    lm_studio: EndpointHealth
    whisper: EndpointHealth
    tts: EndpointHealth


class SessionSummary(BaseModel):
    session_id: str
    message_count: int
    title: str | None = None
    preview: str | None = None
    updated_at: datetime | None = None


class VoiceItem(BaseModel):
    voice_id: str
    name: str


class VoiceCatalogResponse(BaseModel):
    mode: Literal["remote"]
    voices: list[str]
    voice_items: list[VoiceItem] = Field(default_factory=list)
    default_voice: str | None = None
    tts_model: str | None = None
    supports_tone_prompt: bool = True
    supports_speed: bool = True


class TtsModelCatalogResponse(BaseModel):
    mode: Literal["remote"]
    default_model: str | None = None
    models: list[str] = Field(default_factory=list)


class RuntimeModelInfo(BaseModel):
    provider: str
    base_url: str
    endpoint: str
    configured_model: str | None = None
    catalog: list[str] = Field(default_factory=list)


class RuntimeAudioInfo(BaseModel):
    provider: str
    base_url: str
    endpoint: str
    configured_model: str | None = None
    mode: Literal["local", "remote"]


class RuntimeCatalogResponse(BaseModel):
    lm_studio: RuntimeModelInfo
    whisper: RuntimeAudioInfo
    tts: RuntimeModelInfo


class ApiKeyUpdateRequest(BaseModel):
    api_key: str


class SessionRenameRequest(BaseModel):
    title: str


class ApiKeyStatusResponse(BaseModel):
    configured: bool
    masked: str | None = None


class VoiceRenameRequest(BaseModel):
    name: str
    description: str | None = None


class VoiceDesignRequest(BaseModel):
    text: str = Field(min_length=20)
    voice_description: str | None = None
    gender: Literal["female", "male"] = "female"
    accent: str = "american"
    age: Literal["young", "middle_aged", "old"] = "middle_aged"
    accent_strength: float = Field(default=0.35, ge=0.0, le=2.0)


class VoiceDesignCreateRequest(BaseModel):
    voice_name: str
    voice_description: str
    generated_voice_id: str
