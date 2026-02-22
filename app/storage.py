from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

from .models import MemoryMessage, PersonalityProfile


class JsonStore:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.memories_dir = self.path.parent / "memories"
        self.memories_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self.path.exists():
            self._write({"profiles": []})

    def _read(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8-sig") as f:
            raw = json.load(f)
            if not isinstance(raw, dict):
                return {"profiles": []}
            if "profiles" not in raw or not isinstance(raw.get("profiles"), list):
                raw["profiles"] = []
            return raw

    def _write(self, data: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _memory_file_path(self, profile_id: str) -> Path:
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", profile_id).strip("._")
        if not safe:
            safe = "profile"
        return self.memories_dir / f"{safe}.json"

    def _read_profile_memory(self, profile_id: str) -> dict[str, Any]:
        path = self._memory_file_path(profile_id)
        if not path.exists():
            return {"profile_id": profile_id, "sessions": {}}
        with path.open("r", encoding="utf-8-sig") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return {"profile_id": profile_id, "sessions": {}}
        sessions = raw.get("sessions")
        if not isinstance(sessions, dict):
            sessions = {}
        return {"profile_id": profile_id, "sessions": sessions}

    def _write_profile_memory(self, profile_id: str, data: dict[str, Any]) -> None:
        path = self._memory_file_path(profile_id)
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _migrate_legacy_sessions(self, raw: dict[str, Any], profile_id: str) -> None:
        legacy_sessions = raw.get("sessions")
        if not isinstance(legacy_sessions, dict):
            return

        prefix = f"{profile_id}:"
        keys = [k for k in legacy_sessions if isinstance(k, str) and k.startswith(prefix)]
        if not keys:
            return

        profile_memory = self._read_profile_memory(profile_id)
        profile_sessions = profile_memory["sessions"]
        moved_any = False

        for key in keys:
            history = legacy_sessions.get(key)
            session_id = key[len(prefix) :]
            if not session_id or not isinstance(history, list):
                legacy_sessions.pop(key, None)
                continue

            dst = profile_sessions.setdefault(session_id, [])
            if not isinstance(dst, list):
                dst = []
                profile_sessions[session_id] = dst
            for message in history:
                dst.append(message)
            legacy_sessions.pop(key, None)
            moved_any = True

        if moved_any:
            self._write_profile_memory(profile_id, profile_memory)
            self._write(raw)

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
            self._migrate_legacy_sessions(raw, profile_id)
            profile_memory = self._read_profile_memory(profile_id)
            sessions = profile_memory["sessions"]
            history = sessions.setdefault(session_id, [])
            history.append(message.model_dump(mode="json"))
            self._write_profile_memory(profile_id, profile_memory)

    def get_messages(self, session_id: str, profile_id: str, limit: int) -> list[MemoryMessage]:
        with self._lock:
            raw = self._read()
            self._migrate_legacy_sessions(raw, profile_id)
            profile_memory = self._read_profile_memory(profile_id)
            history = profile_memory["sessions"].get(session_id, [])

        messages = [MemoryMessage.model_validate(m) for m in history]
        return messages[-limit:]

    def list_sessions(self, profile_id: str) -> list[dict[str, Any]]:
        with self._lock:
            raw = self._read()
            self._migrate_legacy_sessions(raw, profile_id)
            profile_memory = self._read_profile_memory(profile_id)
            sessions = profile_memory["sessions"]

        out: list[dict[str, Any]] = []
        for session_id, history in sessions.items():
            if not isinstance(history, list):
                continue
            updated_at = None
            if history:
                last = history[-1]
                if isinstance(last, dict):
                    ts = last.get("timestamp")
                    if isinstance(ts, str):
                        try:
                            updated_at = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        except ValueError:
                            updated_at = None
            out.append(
                {
                    "session_id": session_id,
                    "message_count": len(history),
                    "updated_at": updated_at,
                }
            )

        out.sort(
            key=lambda x: x["updated_at"].timestamp() if isinstance(x["updated_at"], datetime) else -1.0,
            reverse=True,
        )
        return out

    def delete_session(self, profile_id: str, session_id: str) -> bool:
        with self._lock:
            raw = self._read()
            self._migrate_legacy_sessions(raw, profile_id)
            profile_memory = self._read_profile_memory(profile_id)
            sessions = profile_memory["sessions"]
            if session_id not in sessions:
                return False
            sessions.pop(session_id, None)
            self._write_profile_memory(profile_id, profile_memory)
            return True

    def delete_profile(self, profile_id: str) -> bool:
        with self._lock:
            raw = self._read()
            profiles = raw.get("profiles", [])
            kept = [p for p in profiles if p.get("id") != profile_id]
            if len(kept) == len(profiles):
                return False
            raw["profiles"] = kept
            self._write(raw)

            memory_path = self._memory_file_path(profile_id)
            if memory_path.exists():
                memory_path.unlink()
            return True

    def keep_only_profiles(self, keep_ids: set[str]) -> dict[str, int]:
        with self._lock:
            raw = self._read()
            profiles = raw.get("profiles", [])
            removed_ids: list[str] = []
            kept_profiles: list[dict[str, Any]] = []
            for profile in profiles:
                pid = str(profile.get("id", ""))
                if pid in keep_ids:
                    kept_profiles.append(profile)
                else:
                    removed_ids.append(pid)

            raw["profiles"] = kept_profiles
            self._write(raw)

            removed_memories = 0
            for pid in removed_ids:
                memory_path = self._memory_file_path(pid)
                if memory_path.exists():
                    memory_path.unlink()
                    removed_memories += 1

            return {"profiles_removed": len(removed_ids), "memories_removed": removed_memories}
