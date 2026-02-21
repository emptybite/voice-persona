# Voice Chatbot Orchestrator (LM Studio + Whisper + Qwen TTS)

This backend gives you a clean API layer you can plug a frontend into later.

## Features
- Configurable upstream endpoints for:
  - LM Studio (`/v1/chat/completions` by default)
  - Whisper transcription (`/v1/audio/transcriptions` by default)
  - Qwen TTS speech synthesis (`/v1/audio/speech` by default)
- Personality profiles with saved:
  - system prompt (personality prompt injection)
  - voice profile (voice id, tone prompt, speed)
- Persistent conversation memory per `profile_id + session_id`.
- API-first design for adding a web/mobile UI later.

## Run
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Configure endpoints
Set environment variables (or `.env`):

```bash
AI_BOT_LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
AI_BOT_LM_STUDIO_CHAT_ENDPOINT=/chat/completions
AI_BOT_LM_STUDIO_MODEL=qwen/qwen3-14b

AI_BOT_WHISPER_BASE_URL=http://127.0.0.1:8001/v1
AI_BOT_WHISPER_TRANSCRIBE_ENDPOINT=/audio/transcriptions

AI_BOT_QWEN_TTS_BASE_URL=http://127.0.0.1:8002/v1
AI_BOT_QWEN_TTS_SPEAK_ENDPOINT=/audio/speech
```

## API overview
- `GET /health` -> shows currently configured upstream base URLs and endpoints.
- `GET /v1/profiles` -> list saved personality profiles.
- `POST /v1/profiles` -> create/update personality + voice profile.
- `POST /v1/chat` -> chat with memory using selected profile.
- `POST /v1/audio/transcribe` -> send audio file to Whisper.
- `POST /v1/audio/speak` -> synthesize voice with Qwen TTS using selected profile voice config.

OpenAPI docs are at `/docs` once server is running.
