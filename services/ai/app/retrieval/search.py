"""Hybrid vector + full-text search across knowledge base chunks.

Calls the Postgres match_knowledge_chunks function defined in migration 0019,
which joins public.knowledge_chunks and public.knowledge_documents and combines
cosine similarity on vector embeddings (70% weight) with tsvector keyword matching
and trigram similarity (30% weight).
"""

from __future__ import annotations

import logging
from typing import Any

import asyncpg

from .embedder import configured_embedder
from .ingest import Embedder

logger = logging.getLogger(__name__)

MATCH_KNOWLEDGE_SQL = """
SELECT
    chunk_id,
    document_id,
    document_title,
    source_type,
    chunk_index,
    content,
    metadata,
    locale,
    similarity,
    combined_score
FROM public.match_knowledge_chunks(
    $1,
    $2::extensions.vector,
    $3,
    $4,
    $5,
    $6
);
"""


async def hybrid_search(
    query: str,
    pool: asyncpg.Pool | None,
    top_k: int = 5,
    min_similarity: float = 0.3,
    locale: str | None = None,
    embedder: Embedder | None = None,
) -> list[dict[str, Any]]:
    """Execute hybrid search combining semantic vector and keyword search.

    Args:
        query: User search text.
        pool: asyncpg connection pool.
        top_k: Maximum number of chunks to return (default 5).
        min_similarity: Minimum cosine similarity threshold (default 0.3).
        locale: Optional language filter ('en' or 'bn').
        embedder: Optional custom embedder; defaults to the configured provider.

    Returns:
        List of dicts representing matched chunks ranked by combined_score descending.
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    if pool is None:
        logger.debug("Database pool not available, skipping hybrid search")
        return []

    vector_str: str | None = None
    try:
        active_embedder = embedder or configured_embedder()
        embedding = await active_embedder.embed(clean_query)
        if embedding:
            vector_str = f"[{','.join(str(round(x, 6)) for x in embedding)}]"
    except Exception as exc:
        logger.warning("Failed to generate embedding for query: %s. Falling back to keyword search.", exc)
        vector_str = None

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                MATCH_KNOWLEDGE_SQL,
                clean_query,
                vector_str,
                top_k,
                min_similarity,
                locale,
                True,
            )
            return [
                {
                    "chunk_id": row["chunk_id"],
                    "document_id": str(row["document_id"]),
                    "document_title": row["document_title"],
                    "source_type": row["source_type"],
                    "chunk_index": row["chunk_index"],
                    "content": row["content"],
                    "metadata": dict(row["metadata"] or {}),
                    "locale": row["locale"],
                    "similarity": float(row["similarity"]) if row["similarity"] is not None else 0.0,
                    "combined_score": float(row["combined_score"]) if row["combined_score"] is not None else 0.0,
                }
                for row in rows
            ]
    except Exception as exc:
        logger.error("Database query error in hybrid_search: %s", exc)
        return []
