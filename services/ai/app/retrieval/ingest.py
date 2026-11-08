"""RAG ingestion primitives for the content tables.

The repository and embedding interfaces keep ingestion testable without a live
Supabase connection or an LLM provider.
"""

from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(frozen=True)
class ContentRecord:
    id: str
    title: str
    body: str
    source_url: str | None = None


class ContentRepository(Protocol):
    async def list_published_content(self) -> Sequence[ContentRecord]: ...


class VectorStore(Protocol):
    async def upsert_chunks(self, content_id: str, chunks: Sequence[str]) -> None: ...


class Embedder(Protocol):
    async def embed(self, text: str) -> Sequence[float]: ...


def split_content(text: str, *, chunk_size: int = 1200, overlap: int = 150) -> list[str]:
    if chunk_size < 1:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size")
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    current_length = 0
    for word in words:
        if current and current_length + len(word) + 1 > chunk_size:
            chunks.append(" ".join(current))
            retained: list[str] = []
            retained_length = 0
            for previous in reversed(current):
                added = len(previous) + (1 if retained else 0)
                if retained and retained_length + added > overlap:
                    break
                if len(previous) > overlap and not retained:
                    break
                retained.append(previous)
                retained_length += added
            current = list(reversed(retained))
            current_length = len(" ".join(current))
        current.append(word)
        current_length += len(word) + (1 if current_length else 0)
    if current:
        chunks.append(" ".join(current))
    return chunks


async def ingest_content_tables(repository: ContentRepository, vector_store: VectorStore) -> int:
    """Ingest all published content once the content tables are available."""
    records = await repository.list_published_content()
    ingested = 0
    for record in records:
        chunks = split_content(f"{record.title}\n\n{record.body}")
        if chunks:
            await vector_store.upsert_chunks(record.id, chunks)
            ingested += 1
    return ingested
