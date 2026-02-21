from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any

from .models import MemoryMessage, PersonalityProfile


class JsonStore:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self.path.exists():
            self._write({"profiles": [], "sessions": {}})

    def _read(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list_profiles(self) -> list[PersonalityProfile]:
        with self._lock:
            raw = self._read()
        return [PersonalityProfile.model_validate(p) for p in raw["profiles"]]

    def get_profile(self, profile_id: str) -> PersonalityProfile | None:
        profiles = self.list_profiles()
        for profile in profiles:
            if profile.id == profile_id:
                return profile
        return None

    def upsert_profile(self, profile: PersonalityProfile) -> PersonalityProfile:
        with self._lock:
            raw = self._read()
            profiles = raw["profiles"]
            for idx, existing in enumerate(profiles):
                if existing["id"] == profile.id:
                    profiles[idx] = profile.model_dump(mode="json")
                    self._write(raw)
                    return profile

            profiles.append(profile.model_dump(mode="json"))
            self._write(raw)
        return profile

    def append_message(self, session_id: str, profile_id: str, message: MemoryMessage) -> None:
        with self._lock:
            raw = self._read()
            sessions = raw["sessions"]
            key = f"{profile_id}:{session_id}"
            history = sessions.setdefault(key, [])
            history.append(message.model_dump(mode="json"))
            self._write(raw)

    def get_messages(self, session_id: str, profile_id: str, limit: int) -> list[MemoryMessage]:
        with self._lock:
            raw = self._read()
            key = f"{profile_id}:{session_id}"
            history = raw["sessions"].get(key, [])

        messages = [MemoryMessage.model_validate(m) for m in history]
        return messages[-limit:]
