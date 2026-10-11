from fastapi.testclient import TestClient

from services.ai.app.main import app


def test_health_returns_request_id():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"]


def test_health_preserves_request_id():
    with TestClient(app) as client:
        response = client.get("/health", headers={"x-request-id": "phase0-test"})

    assert response.headers["x-request-id"] == "phase0-test"
