import asyncio
import hashlib
import hmac
import json
import time
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient

from services.ai.app.agents.chat_agent import TextChunk
from services.ai.app.api.v1 import routes
from services.ai.app.main import app
from services.ai.app.security.guardrails import (
    StreamTimeoutError,
    stream_with_timeout,
)


def _signature(body: str, timestamp: str, secret: str) -> str:
    return hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()


# -----------------------------------------------------------------------------
# Unit Tests (stream_with_timeout)
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_with_timeout_completes_normally():
    async def fast_stream():
        yield "chunk 1"
        yield "chunk 2"
        yield "chunk 3"

    results = []
    async for chunk in stream_with_timeout(fast_stream(), timeout_seconds=1.0):
        results.append(chunk)

    assert results == ["chunk 1", "chunk 2", "chunk 3"]


@pytest.mark.asyncio
async def test_stream_with_timeout_raises_on_slow_stream():
    async def slow_stream():
        yield "first chunk"
        await asyncio.sleep(0.2)  # Exceeds the 0.05s timeout
        yield "delayed chunk"

    results = []
    with pytest.raises(StreamTimeoutError) as exc_info:
        async for chunk in stream_with_timeout(slow_stream(), timeout_seconds=0.05):
            results.append(chunk)

    assert results == ["first chunk"]
    assert exc_info.value.code == "timeout"


# -----------------------------------------------------------------------------
# Route Integration Test (Phase 2.8 Fix 6 Streaming Timeout SSE)
# -----------------------------------------------------------------------------

def test_chat_stream_timeout_emits_sse_error(monkeypatch):
    secret = "test-secret"
    timestamp = str(int(time.time()))
    body = {"messages": [{"role": "user", "content": "Tell me a long story"}], "locale": "en"}
    body_text = json.dumps(body, separators=(",", ":"))

    async def hanging_stream(_payload, pool=None, **kwargs):
        yield TextChunk(text="First part")
        await asyncio.sleep(0.2)  # Delay longer than the configured timeout
        yield TextChunk(text="Never reached")

    monkeypatch.setattr(
        routes,
        "get_settings",
        lambda: SimpleNamespace(
            ai_hmac_secret_current=secret,
            llm_api_key="test-key",
            ai_enabled=True,
            ai_stream_timeout_seconds=0.05,  # Short timeout for test
        ),
    )
    monkeypatch.setattr(routes, "run_agent_stream", hanging_stream)

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
    assert 'event: text_delta\ndata: {"text": "First part"}\n\n' in response.text
    assert 'event: error\ndata: {"code": "timeout", "message": "Response generation timed out.", "request_id": "' in response.text
