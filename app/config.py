from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_BOT_", env_file=".env", extra="ignore")

    lm_studio_base_url: str = Field(default="http://192.168.1.2:1234/v1")
    lm_studio_chat_endpoint: str = Field(default="/chat/completions")
    lm_studio_model: str = Field(default="dolphin-2.8-mistral-7b-v02")
    lm_studio_api_key: str = Field(default="")
    lm_studio_api_key_override: str = Field(default="")

    whisper_base_url: str = Field(default="http://127.0.0.1:8000")
    whisper_transcribe_endpoint: str = Field(default="/_local/whisper/v1/audio/transcriptions")
    whisper_local_model: str = Field(default="base")

    elevenlabs_base_url: str = Field(default="https://api.elevenlabs.io")
    elevenlabs_speak_endpoint: str = Field(default="/v1/text-to-speech")
    elevenlabs_api_key: str = Field(default="")
    elevenlabs_model: str = Field(default="eleven_turbo_v2_5")
    elevenlabs_model_catalog: str = Field(default="eleven_turbo_v2_5,eleven_multilingual_v2,eleven_v3")
    elevenlabs_voice_id: str = Field(default="")
    elevenlabs_output_format_mp3: str = Field(default="mp3_44100_128")
    elevenlabs_output_format_wav: str = Field(default="pcm_22050")
    tts_expression_tags_enabled: bool = Field(default=True)

    request_timeout_seconds: float = Field(default=60.0)
    data_file: str = Field(default="data/store.json")


settings = Settings()
