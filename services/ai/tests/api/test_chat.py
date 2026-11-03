import hashlib
import hmac
import json
import time
from types import SimpleNamespace

from fastapi.testclient import TestClient

from services.ai.app.agents.chat_agent import TextChunk
from services.ai.app.api.v1 import routes
from services.ai.app.main import app


def _signature(body: str, timestamp: str, secret: str) -> str:
	return hmac.new(
		secret.encode(),
		f"{timestamp}.{body}".encode(),
		hashlib.sha256,
	).hexdigest()


def test_chat_requires_service_authentication():
	body = {"messages": [{"role": "user", "content": "Hello"}]}

	with TestClient(app) as client:
		response = client.post("/v1/chat", json=body)

	assert response.status_code == 401
	assert response.json() == {"detail": "missing service authentication"}


def test_chat_streams_contract_events(monkeypatch):
	secret = "test-secret"
	timestamp = str(int(time.time()))
	body = {"messages": [{"role": "user", "content": "Hello"}], "locale": "en"}
	body_text = json.dumps(body, separators=(",", ":"))

	async def fake_stream(_payload, pool=None, **kwargs):
		yield TextChunk(text="Hi")
		yield TextChunk(text=" there")

	monkeypatch.setattr(
		routes,
		"get_settings",
		lambda: SimpleNamespace(
			ai_hmac_secret_current=secret,
			llm_api_key=None,
			ollama_url="http://localhost:11434",
			ai_enabled=True,
		),
	)
	monkeypatch.setattr(routes, "run_agent_stream", fake_stream)

	with TestClient(app) as client:
		response = client.post(
			"/v1/chat",
			content=body_text,
			headers={
				"content-type": "application/json",
				"x-ai-timestamp": timestamp,
				"x-ai-signature": _signature(body_text, timestamp, secret),
			},
		)

	assert response.status_code == 200
	assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
	assert response.text == (
		'event: message_start\ndata: {"conversation_id": ""}\n\n'
		'event: text_delta\ndata: {"text": "Hi"}\n\n'
		'event: text_delta\ndata: {"text": " there"}\n\n'
		'event: message_end\ndata: {"reason": "stop"}\n\n'
	)
