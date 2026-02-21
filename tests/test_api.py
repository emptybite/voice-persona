from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_has_expected_paths():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["lm_studio"]["endpoint"] == "/chat/completions"
    assert payload["whisper"]["endpoint"] == "/audio/transcriptions"
    assert payload["qwen_tts"]["endpoint"] == "/audio/speech"
