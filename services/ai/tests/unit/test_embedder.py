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
            embedding_model="qwen3-embedding:0.6b",
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
            embedding_model=None,
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
