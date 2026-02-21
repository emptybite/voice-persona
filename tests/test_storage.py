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
