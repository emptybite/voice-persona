# Voice Persona Studio Frontend

This directory contains the React + TypeScript frontend used to exercise the FastAPI backend in `../app`.

## What it covers
- Profile selection
- TTS model and voice selection
- Chat loop against `/v1/chat`

## Local development
```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE` only when the API is not served from the same origin.

## Notes
- The production static UI used by FastAPI lives under `app/static/`.
- This React app is kept as a separate client for faster iteration and typed API usage.
