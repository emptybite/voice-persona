# Voice Persona

A small FastAPI app for chatting with custom personas and giving them voices.

## Quick Demo

<img width="1919" height="990" alt="image" src="https://github.com/user-attachments/assets/40fb41f3-f4b6-4a50-bb04-5060f57cad43" />


You can:

- make multiple personas with their own name, avatar, voice, and personality
- keep separate conversation threads for each one
- talk by text or transcribe audio
- play replies with ElevenLabs, clone voices, and design new ones

## Features

- Persona list with per-persona settings
- Per-conversation memory and conversation renaming
- Built-in web UI served by the backend
- Local Whisper transcription
- ElevenLabs TTS, voice cloning, and voice design
- Model/API key controls in the Models tab

## Stack

- FastAPI
- Plain HTML/CSS/JS frontend served from `app/static`
- LM Studio compatible chat endpoint
- Whisper for local transcription
- ElevenLabs for voice

## How to Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open:

- `http://127.0.0.1:8000/ui`
- `http://127.0.0.1:8000/docs`

Or on Windows:

```powershell
.\start_all.bat
```

## Note

This is a personal project. It works well locally, but it’s not meant to be a big production system.
