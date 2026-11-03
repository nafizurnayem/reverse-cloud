"""Configured embedders for RAG ingestion and retrieval.

Implements the Embedder Protocol defined in retrieval.ingest so the ingestion
pipeline and hybrid search share the same embedding function without coupling
either to a specific provider.
"""

from __future__ import annotations

from collections.abc import Sequence

import httpx
from openai import AsyncOpenAI

from ..config import get_settings

OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
OLLAMA_EMBEDDING_MODEL = "qwen3-embedding:0.6b"


class OpenAIEmbedder:
    """Async embedder backed by OpenAI text-embedding-3-small."""

    def __init__(self, api_key: str | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.llm_api_key
        self._model = settings.embedding_model or OPENAI_EMBEDDING_MODEL
        self._dimensions = settings.embed_dim
        if not self._api_key:
            raise RuntimeError("LLM_API_KEY is required for the embedder")

    async def embed(self, text: str) -> Sequence[float]:
        """Return a normalised embedding vector for *text*."""
        client = AsyncOpenAI(api_key=self._api_key)
        try:
            response = await client.embeddings.create(
                input=text.replace("\n", " "),
                model=self._model,
                dimensions=self._dimensions,
            )
            return response.data[0].embedding
        finally:
            await client.close()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts in a single API call (max 2048 inputs)."""
        if not texts:
            return []
        client = AsyncOpenAI(api_key=self._api_key)
        try:
            response = await client.embeddings.create(
                input=[t.replace("\n", " ") for t in texts],
                model=self._model,
                dimensions=self._dimensions,
            )
            # API returns embeddings in the same order as input
            return [item.embedding for item in sorted(response.data, key=lambda d: d.index)]
        finally:
            await client.close()


class OllamaEmbedder:
    """Async embedder backed by Ollama's native embedding API."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.ollama_url:
            raise RuntimeError("OLLAMA_URL is required for the Ollama embedder")
        self._url = settings.ollama_url.rstrip("/")
        self._model = settings.embedding_model or OLLAMA_EMBEDDING_MODEL
        self._dimensions = settings.embed_dim

    async def embed(self, text: str) -> Sequence[float]:
        embeddings = await self.embed_batch([text])
        return embeddings[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._url}/api/embed",
                json={
                    "model": self._model,
                    "input": [text.replace("\n", " ") for text in texts],
                    "dimensions": self._dimensions,
                },
            )
            response.raise_for_status()

        payload = response.json()
        embeddings = payload.get("embeddings") if isinstance(payload, dict) else None
        if not isinstance(embeddings, list) or len(embeddings) != len(texts):
            raise RuntimeError("Ollama returned an invalid embedding response")
        if any(not isinstance(vector, list) or len(vector) != self._dimensions for vector in embeddings):
            raise RuntimeError("Ollama returned an unexpected embedding dimension")
        return [[float(value) for value in vector] for vector in embeddings]


def configured_embedder() -> OpenAIEmbedder | OllamaEmbedder:
    """Use Ollama when configured, otherwise retain the OpenAI provider."""
    if get_settings().ollama_url:
        return OllamaEmbedder()
    return OpenAIEmbedder()
