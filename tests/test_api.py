from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_has_expected_paths():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["lm_studio"]["endpoint"] == "/chat/completions"
    assert payload["whisper"]["endpoint"] == "/_local/whisper/v1/audio/transcriptions"
    assert payload["tts"]["endpoint"] == "/v1/text-to-speech"


def test_ui_page_serves_static_html():
    client = TestClient(app)
    response = client.get("/ui")
    assert response.status_code == 200
    assert "Voice Persona Studio" in response.text
