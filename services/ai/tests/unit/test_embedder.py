from types import SimpleNamespace

import httpx
import pytest

from services.ai.app.retrieval import embedder


@pytest.mark.asyncio
async def test_ollama_embedder_requests_configured_dimensions(monkeypatch) -> None:
    captured: dict = {}

    monkeypatch.setattr(
        embedder,
        "get_settings",
        lambda: SimpleNamespace(
            ollama_url="http://localhost:11434/",
            ollama_embedding_model="qwen3-embedding:0.6b",
            embed_dim=3,
        ),
    )

    async def fake_post(_client, url, **kwargs):
        captured.update(url=url, json=kwargs["json"])
        return httpx.Response(
            200,
            json={"embeddings": [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    result = await embedder.OllamaEmbedder().embed_batch(["first\nline", "second"])

    assert result == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    assert captured == {
        "url": "http://localhost:11434/api/embed",
        "json": {
            "model": "qwen3-embedding:0.6b",
            "input": ["first line", "second"],
            "dimensions": 3,
        },
    }


@pytest.mark.asyncio
async def test_ollama_embedder_rejects_wrong_dimensions(monkeypatch) -> None:
    monkeypatch.setattr(
        embedder,
        "get_settings",
        lambda: SimpleNamespace(
            ollama_url="http://localhost:11434",
            ollama_embedding_model="qwen3-embedding:0.6b",
            embed_dim=3,
        ),
    )

    async def fake_post(_client, url, **_kwargs):
        return httpx.Response(
            200,
            json={"embeddings": [[0.1, 0.2]]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    with pytest.raises(RuntimeError, match="unexpected embedding dimension"):
        await embedder.OllamaEmbedder().embed("query")


@pytest.mark.asyncio
async def test_gemini_embedder_requests_matching_dimensions(monkeypatch) -> None:
    captured: dict = {}

    monkeypatch.setattr(
        embedder,
        "get_settings",
        lambda: SimpleNamespace(
            gemini_api_key="gemini-key",
            llm_api_key=None,
            llm_model="",
            gemini_embedding_model="gemini-embedding-2",
            embed_dim=3,
        ),
    )

    class Models:
        async def embed_content(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                embeddings=[SimpleNamespace(values=[0.1, 0.2, 0.3])]
            )

    class AsyncClient:
        models = Models()

        async def aclose(self):
            captured["closed"] = True

    monkeypatch.setattr(
        embedder.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(aio=AsyncClient(), api_key=kwargs["api_key"]),
    )

    assert await embedder.GeminiEmbedder().embed("first\nline") == [0.1, 0.2, 0.3]
    assert captured["model"] == "gemini-embedding-2"
    assert captured["contents"] == ["first line"]
    assert captured["config"].output_dimensionality == 3
    assert captured["closed"] is True


@pytest.mark.asyncio
async def test_embedding_fallback_uses_gemini_after_ollama_failure() -> None:
    class FailingOllama:
        async def embed_batch(self, _texts):
            raise httpx.ConnectError("offline")

    class WorkingGemini:
        async def embed_batch(self, texts):
            assert texts == ["query"]
            return [[0.1, 0.2]]

    fallback = embedder.FallbackEmbedder(FailingOllama(), WorkingGemini())
    assert await fallback.embed("query") == [0.1, 0.2]
