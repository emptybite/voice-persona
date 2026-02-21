from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_BOT_", env_file=".env", extra="ignore")

    lm_studio_base_url: str = Field(default="http://127.0.0.1:1234/v1")
    lm_studio_chat_endpoint: str = Field(default="/chat/completions")
    lm_studio_model: str = Field(default="qwen/qwen3-14b")

    whisper_base_url: str = Field(default="http://127.0.0.1:8001/v1")
    whisper_transcribe_endpoint: str = Field(default="/audio/transcriptions")

    qwen_tts_base_url: str = Field(default="http://127.0.0.1:8002/v1")
    qwen_tts_speak_endpoint: str = Field(default="/audio/speech")

    request_timeout_seconds: float = Field(default=60.0)
    data_file: str = Field(default="data/store.json")


settings = Settings()
