"""Configured embedders for RAG ingestion and retrieval.

Implements the Embedder Protocol defined in retrieval.ingest so the ingestion
pipeline and hybrid search share the same embedding function without coupling
either to a specific provider.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

import httpx
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from ..config import get_settings, resolved_gemini_api_key, resolved_gemini_embedding_model

logger = logging.getLogger(__name__)

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
        self._model = settings.ollama_embedding_model or OLLAMA_EMBEDDING_MODEL
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


class GeminiEmbedder:
    """Async fallback embedder backed by the Gemini API."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = resolved_gemini_api_key(settings)
        if not self._api_key:
            raise RuntimeError("GEMINI_API_KEY is required for the Gemini embedder")
        self._model = resolved_gemini_embedding_model(settings)
        self._dimensions = settings.embed_dim

    async def embed(self, text: str) -> Sequence[float]:
        embeddings = await self.embed_batch([text])
        return embeddings[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        client = genai.Client(api_key=self._api_key)
        try:
            response = await client.aio.models.embed_content(
                model=self._model,
                contents=[text.replace("\n", " ") for text in texts],
                config=types.EmbedContentConfig(output_dimensionality=self._dimensions),
            )
        finally:
            await client.aio.aclose()

        embeddings = response.embeddings
        if not embeddings or len(embeddings) != len(texts):
            raise RuntimeError("Gemini returned an invalid embedding response")
        vectors = [embedding.values for embedding in embeddings]
        if any(vector is None or len(vector) != self._dimensions for vector in vectors):
            raise RuntimeError("Gemini returned an unexpected embedding dimension")
        return [[float(value) for value in vector] for vector in vectors if vector is not None]


class FallbackEmbedder:
    """Retry embedding requests with Gemini after an Ollama operational failure."""

    def __init__(self, primary: OllamaEmbedder, fallback: GeminiEmbedder) -> None:
        self._primary = primary
        self._fallback = fallback

    async def embed(self, text: str) -> Sequence[float]:
        embeddings = await self.embed_batch([text])
        return embeddings[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        try:
            return await self._primary.embed_batch(texts)
        except (httpx.HTTPError, RuntimeError, TypeError, ValueError) as exc:
            logger.warning("Ollama embeddings failed; using Gemini fallback: %s", exc)
            return await self._fallback.embed_batch(texts)


def configured_embedder() -> OpenAIEmbedder | OllamaEmbedder | GeminiEmbedder | FallbackEmbedder:
    """Prefer Ollama, then Gemini, while retaining OpenAI compatibility."""
    settings = get_settings()
    ollama = OllamaEmbedder() if settings.ollama_url else None
    gemini = GeminiEmbedder() if resolved_gemini_api_key(settings) else None
    if ollama and gemini:
        return FallbackEmbedder(ollama, gemini)
    if ollama:
        return ollama
    if gemini:
        return gemini
    return OpenAIEmbedder()
