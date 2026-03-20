from app.models import MemoryMessage, PersonalityProfile
from app.storage import JsonStore


def test_profile_and_memory_persistence(tmp_path):
    store_path = tmp_path / "store.json"
    store = JsonStore(str(store_path))

    profile = PersonalityProfile(name="helper", system_prompt="Be helpful")
    store.upsert_profile(profile)

    loaded = store.get_profile(profile.id)
    assert loaded is not None
    assert loaded.name == "helper"

    store.append_message("session-1", profile.id, MemoryMessage(role="user", content="hello"))
    store.append_message("session-1", profile.id, MemoryMessage(role="assistant", content="hi"))

    msgs = store.get_messages("session-1", profile.id, limit=10)
    assert [m.role for m in msgs] == ["user", "assistant"]

    profile_memory_file = tmp_path / "memories" / f"{profile.id}.json"
    assert profile_memory_file.exists()

    sessions = store.list_sessions(profile.id)
    assert len(sessions) == 1
    assert sessions[0]["session_id"] == "session-1"
    assert sessions[0]["message_count"] == 2
