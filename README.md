# Voice Chatbot (LM Studio + Whisper + ElevenLabs)

Backend + built-in web UI for persona chat, STT, and TTS.

## Features
- LM Studio chat orchestration with profile-scoped memory.
- Whisper transcription (`/_local/whisper/v1/audio/transcriptions` by default).
- ElevenLabs speech synthesis (`/v1/text-to-speech/{voice_id}` upstream).
- Built-in dark UI at `/ui` with:
  - profile editor
  - sessions/history
  - file transcription
  - push-to-talk + chat dock

## Quick Start
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open:
- API docs: `http://127.0.0.1:8000/docs`
- UI: `http://127.0.0.1:8000/ui`

## Environment
Set these in `.env` (prefix is `AI_BOT_`):

```bash
AI_BOT_LM_STUDIO_BASE_URL=http://192.168.1.2:1234/v1
AI_BOT_LM_STUDIO_CHAT_ENDPOINT=/chat/completions
AI_BOT_LM_STUDIO_MODEL=dolphin-2.8-mistral-7b-v02

AI_BOT_WHISPER_BASE_URL=http://127.0.0.1:8000
AI_BOT_WHISPER_TRANSCRIBE_ENDPOINT=/_local/whisper/v1/audio/transcriptions
AI_BOT_WHISPER_LOCAL_MODEL=base

AI_BOT_ELEVENLABS_BASE_URL=https://api.elevenlabs.io
AI_BOT_ELEVENLABS_SPEAK_ENDPOINT=/v1/text-to-speech
AI_BOT_ELEVENLABS_API_KEY=YOUR_KEY
AI_BOT_ELEVENLABS_MODEL=eleven_turbo_v2_5
AI_BOT_ELEVENLABS_MODEL_CATALOG=eleven_turbo_v2_5,eleven_multilingual_v2
AI_BOT_ELEVENLABS_VOICE_ID=
AI_BOT_ELEVENLABS_OUTPUT_FORMAT_MP3=mp3_44100_128
AI_BOT_ELEVENLABS_OUTPUT_FORMAT_WAV=pcm_22050
```

Notes:
- `AI_BOT_ELEVENLABS_API_KEY` is required for `/v1/audio/speak` and `/ws/tts`.
- If profile voice is `default`/empty, backend falls back to `AI_BOT_ELEVENLABS_VOICE_ID`.
- Whisper local mode requires `ffmpeg` on `PATH`.

## API Overview
- `GET /health`
- `GET /v1/profiles`
- `POST /v1/profiles`
- `GET /v1/profiles/{profile_id}/sessions`
- `GET /v1/profiles/{profile_id}/sessions/{session_id}/messages`
- `POST /v1/chat`
- `POST /v1/audio/transcribe`
- `POST /v1/audio/speak`
- `GET /v1/tts/models`
- `GET /v1/voices`
- `WS /ws/tts`

## Push-to-Talk Loop
```powershell
.\.venv\Scripts\python.exe scripts\push_to_talk.py --api-base http://127.0.0.1:8000
```

## WebSocket TTS Message
```json
{"profile_id":"<profile-id>","text":"Long text to speak...","tts_model":"eleven_turbo_v2_5"}
```

