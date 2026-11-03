#!/usr/bin/env python3
"""Rebuild existing knowledge vectors with the configured embedding provider."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.retrieval.embedder import configured_embedder


async def reindex_knowledge(connection: asyncpg.Connection, batch_size: int = 32) -> int:
    rows = await connection.fetch(
        "SELECT id, content FROM public.knowledge_chunks ORDER BY id"
    )
    embedder = configured_embedder()
    for offset in range(0, len(rows), batch_size):
        batch = rows[offset : offset + batch_size]
        embeddings = await embedder.embed_batch([row["content"] for row in batch])
        await connection.executemany(
            "UPDATE public.knowledge_chunks SET embedding = $2::extensions.vector WHERE id = $1",
            [
                (row["id"], f"[{','.join(str(value) for value in embedding)}]")
                for row, embedding in zip(batch, embeddings, strict=True)
            ],
        )
    return len(rows)


async def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL_AI is required")
    connection = await asyncpg.connect(settings.database_url)
    try:
        count = await reindex_knowledge(connection)
        print(f"Re-indexed {count} knowledge chunks")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
