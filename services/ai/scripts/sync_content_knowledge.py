#!/usr/bin/env python3
"""Synchronize published website content into the public AI knowledge base."""

from __future__ import annotations

import asyncio
import argparse
import logging
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from scripts.ingest_knowledge import ingest_entries

logger = logging.getLogger(__name__)


PUBLISHED_CONTENT_SQL = """
select 'service' as source_type, id as source_id, name_en as title,
       concat_ws(E'\n\n', summary_en, body_en) as content, 'en' as locale
from public.services where is_published and archived_at is null
union all
select 'service', id, name_bn, concat_ws(E'\n\n', summary_bn, body_bn), 'bn'
from public.services
where is_published and archived_at is null and nullif(btrim(name_bn), '') is not null
union all
select 'faq', id, question_en, answer_en, 'en'
from public.faqs where is_published
union all
select 'faq', id, question_bn, answer_bn, 'bn'
from public.faqs
where is_published and nullif(btrim(question_bn), '') is not null
  and nullif(btrim(answer_bn), '') is not null
union all
select 'portfolio', id, title_en,
       concat_ws(E'\n\n', summary_en, challenge_en, solution_en, result_en), 'en'
from public.portfolio_items where is_published and client_consent
union all
select 'portfolio', id, title_bn,
       concat_ws(E'\n\n', summary_bn, challenge_bn, solution_bn, result_bn), 'bn'
from public.portfolio_items
where is_published and client_consent and nullif(btrim(title_bn), '') is not null
union all
select 'blog', id, title_en, concat_ws(E'\n\n', excerpt_en, body_en), 'en'
from public.blog_posts where status = 'published'
union all
select 'blog', id, title_bn, concat_ws(E'\n\n', excerpt_bn, body_bn), 'bn'
from public.blog_posts
where status = 'published' and nullif(btrim(title_bn), '') is not null
  and nullif(btrim(body_bn), '') is not null;
"""


async def sync_content(connection: asyncpg.Connection) -> dict[str, int]:
    rows = await connection.fetch(PUBLISHED_CONTENT_SQL)
    entries = [
        {
            "source_type": row["source_type"],
            "source_id": str(row["source_id"]),
            "title": row["title"],
            "content": row["content"],
            "locale": row["locale"],
            "visibility": "public",
        }
        for row in rows
    ]
    result = await ingest_entries(connection, entries, generate_embeddings=True)

    for source_type in ("service", "faq", "portfolio", "blog"):
        active_ids = [row["source_id"] for row in rows if row["source_type"] == source_type]
        await connection.execute(
            """
            UPDATE public.knowledge_documents
            SET is_active = false
            WHERE source_type = $1
              AND source_id IS NOT NULL
              AND NOT (source_id = ANY($2::uuid[]));
            """,
            source_type,
            active_ids,
        )
    return result


async def sync_once() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL_AI is required")
    connection = await asyncpg.connect(settings.database_url)
    try:
        result = await sync_content(connection)
        print(
            f"Knowledge sync: {result['documents_inserted']} new, "
            f"{result['documents_updated']} updated, "
            f"{result['documents_skipped']} unchanged, "
            f"{result['chunks_inserted']} chunks"
        )
    finally:
        await connection.close()


async def main(watch: bool = False, interval_seconds: int = 300) -> None:
    while True:
        try:
            await sync_once()
        except Exception:
            if not watch:
                raise
            logger.exception("Knowledge sync failed; retrying")
        if not watch:
            return
        await asyncio.sleep(interval_seconds)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync public website content into AI knowledge.")
    parser.add_argument("--watch", action="store_true")
    parser.add_argument("--interval", type=int, default=300)
    args = parser.parse_args()
    if args.interval < 60:
        parser.error("--interval must be at least 60 seconds")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(main(watch=args.watch, interval_seconds=args.interval))
