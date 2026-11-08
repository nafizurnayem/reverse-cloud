#!/usr/bin/env python3
"""Batch-ingest knowledge entries from a JSONL file into the knowledge base (Phase 5, Wave 3).

Usage:
    python -m scripts.ingest_knowledge --file questions_and_answers.jsonl

Each line in the JSONL file should be a JSON object with:
    {
        "title":       "How long does a website project take?",
        "content":     "A typical website project takes 4-8 weeks depending on ...",
        "source_type": "manual",        // optional, defaults to "manual"
        "source_id":   null,             // required for service/faq/portfolio/blog
        "visibility":  "private",        // set "public" for website chat
        "locale":      "en"              // optional, defaults to "en"
    }

The script will:
    1. Parse and validate each entry
    2. Split long content into chunks using the existing chunking logic
    3. Generate embeddings via the configured Ollama or OpenAI embedder
    4. Insert into knowledge_documents and knowledge_chunks tables
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import sys
import uuid
from pathlib import Path
from typing import Any

import asyncpg

# Add the AI service root to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.retrieval.ingest import split_content

logger = logging.getLogger(__name__)

INSERT_DOCUMENT_SQL = """
INSERT INTO public.knowledge_documents
  (id, title, source_type, source_id, locale, content_hash, visibility, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, true)
RETURNING id;
"""

UPDATE_DOCUMENT_SQL = """
UPDATE public.knowledge_documents
SET title = $2, content_hash = $3, visibility = $4, is_active = true
WHERE id = $1;
"""

INSERT_CHUNK_SQL = """
INSERT INTO public.knowledge_chunks (document_id, chunk_index, content, locale, embedding)
VALUES ($1, $2, $3, $4, $5::extensions.vector);
"""


def load_entries(filepath: Path) -> list[dict[str, Any]]:
    """Load and validate JSONL entries."""
    entries: list[dict[str, Any]] = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                logger.warning("Skipping invalid JSON on line %d: %s", line_num, exc)
                continue

            if "title" not in entry or "content" not in entry:
                logger.warning("Skipping line %d: missing 'title' or 'content'", line_num)
                continue

            entries.append(
                {
                    "title": entry["title"],
                    "content": entry["content"],
                    "source_type": entry.get("source_type", "manual"),
                    "source_id": entry.get("source_id"),
                    "visibility": entry.get("visibility", "private"),
                    "locale": entry.get("locale", "en"),
                }
            )
    return entries


async def ingest_entries(
    connection: asyncpg.Connection,
    entries: list[dict[str, Any]],
    generate_embeddings: bool = True,
) -> dict[str, int]:
    """Insert entries as knowledge documents and chunks.

    Args:
        connection: Active asyncpg connection.
        entries: Validated knowledge entries.
        generate_embeddings: Whether to generate vector embeddings.

    Returns:
        Summary dict with counts of documents and chunks ingested.
    """
    embedder = None
    if generate_embeddings:
        try:
            from app.retrieval.embedder import configured_embedder
            embedder = configured_embedder()
        except RuntimeError:
            logger.warning("No embedding provider configured; inserting chunks without embeddings")

    docs_inserted = 0
    docs_updated = 0
    docs_skipped = 0
    chunks_inserted = 0

    for entry in entries:
        doc_id = uuid.uuid4()
        title = entry["title"]
        locale = entry["locale"]
        source_type = entry["source_type"]
        source_id = uuid.UUID(entry["source_id"]) if entry.get("source_id") else None
        visibility = entry.get("visibility", "private")
        if source_type not in {"service", "faq", "portfolio", "blog", "policy", "manual"}:
            raise ValueError(f"Unsupported source_type: {source_type}")
        if source_type not in {"policy", "manual"} and source_id is None:
            raise ValueError(f"source_id is required for source_type={source_type}")
        if locale not in {"en", "bn"}:
            raise ValueError(f"Unsupported locale: {locale}")
        if visibility not in {"public", "private"}:
            raise ValueError(f"Unsupported visibility: {visibility}")
        content_hash = hashlib.sha256(entry["content"].encode("utf-8")).hexdigest()

        existing = await connection.fetchrow(
            """
            SELECT id, content_hash
            FROM public.knowledge_documents
            WHERE source_type = $1
              AND source_id IS NOT DISTINCT FROM $2
              AND locale = $3
              AND ($2 IS NOT NULL OR title = $4)
            LIMIT 1;
            """,
            source_type,
            source_id,
            locale,
            title,
        )
        if existing and existing["content_hash"] == content_hash:
            docs_skipped += 1
            continue

        if existing:
            doc_id = existing["id"]
            await connection.execute(UPDATE_DOCUMENT_SQL, doc_id, title, content_hash, visibility)
            await connection.execute("DELETE FROM public.knowledge_chunks WHERE document_id = $1", doc_id)
            docs_updated += 1
        else:
            await connection.execute(
                INSERT_DOCUMENT_SQL,
                doc_id,
                title,
                source_type,
                source_id,
                locale,
                content_hash,
                visibility,
            )
            docs_inserted += 1

        # Split content into chunks
        full_text = f"{title}\n\n{entry['content']}"
        chunks = split_content(full_text, chunk_size=1200)

        for idx, chunk_text in enumerate(chunks):
            embedding_str = None
            if embedder:
                try:
                    embedding = await embedder.embed(chunk_text)
                    embedding_str = f"[{','.join(str(round(x, 6)) for x in embedding)}]"
                except Exception as exc:
                    logger.warning("Embedding failed for chunk %d of '%s': %s", idx, title, exc)

            await connection.execute(
                INSERT_CHUNK_SQL,
                doc_id,
                idx,
                chunk_text,
                locale,
                embedding_str,
            )
            chunks_inserted += 1

    return {
        "documents_inserted": docs_inserted,
        "documents_updated": docs_updated,
        "documents_skipped": docs_skipped,
        "chunks_inserted": chunks_inserted,
    }


async def main(filepath: Path, skip_embeddings: bool = False) -> None:
    """CLI entry point."""
    settings = get_settings()
    if not settings.database_url:
        print("ERROR: DATABASE_URL is required", file=sys.stderr)
        sys.exit(1)

    entries = load_entries(filepath)
    if not entries:
        print("No valid entries found in the input file.")
        sys.exit(1)

    print(f"Loaded {len(entries)} entries from {filepath}")

    conn = await asyncpg.connect(settings.database_url)
    try:
        result = await ingest_entries(conn, entries, generate_embeddings=not skip_embeddings)
        print(
            f"Ingested {result['documents_inserted']} new, {result['documents_updated']} updated, "
            f"{result['documents_skipped']} unchanged documents and {result['chunks_inserted']} chunks"
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest knowledge entries from JSONL into the knowledge base.")
    parser.add_argument("--file", "-f", type=Path, required=True, help="Path to the JSONL file with entries.")
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Skip embedding generation (useful for testing without an API key).",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    asyncio.run(main(args.file, skip_embeddings=args.skip_embeddings))
