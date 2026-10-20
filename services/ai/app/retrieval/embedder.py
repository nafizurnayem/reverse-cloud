"""Concrete OpenAI embedder for RAG ingestion and retrieval.

Implements the Embedder Protocol defined in retrieval.ingest so the ingestion
pipeline and hybrid search share the same embedding function without coupling
either to a specific provider.
"""

from __future__ import annotations

from collections.abc import Sequence

from openai import AsyncOpenAI

from ..config import get_settings

# Model produces 1536-dimensional vectors; matches the knowledge_chunks table.
EMBEDDING_MODEL = "text-embedding-3-small"


class OpenAIEmbedder:
    """Async embedder backed by OpenAI text-embedding-3-small."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().llm_api_key
        if not self._api_key:
            raise RuntimeError("LLM_API_KEY is required for the embedder")

    async def embed(self, text: str) -> Sequence[float]:
        """Return a normalised embedding vector for *text*."""
        client = AsyncOpenAI(api_key=self._api_key)
        try:
            response = await client.embeddings.create(
                input=text.replace("\n", " "),
                model=EMBEDDING_MODEL,
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
                model=EMBEDDING_MODEL,
            )
            # API returns embeddings in the same order as input
            return [item.embedding for item in sorted(response.data, key=lambda d: d.index)]
        finally:
            await client.close()
