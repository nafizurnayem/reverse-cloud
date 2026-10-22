"""Transcript quality review for Bangla and English chat sessions (Phase 5, Wave 1).

Queries the chat_messages table for recent conversations, analyses language
distribution, response length, and flags potential quality issues.  Results
are returned as a structured dict suitable for logging, CLI display, or a
future admin dashboard endpoint.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)

# ── SQL ──────────────────────────────────────────────────────────────────
RECENT_CONVERSATIONS_SQL = """
SELECT
    cm.conversation_id,
    cm.role,
    cm.content,
    cm.locale,
    cm.tokens_in,
    cm.tokens_out,
    cm.created_at
FROM public.chat_messages cm
WHERE cm.created_at >= $1
ORDER BY cm.conversation_id, cm.created_at;
"""

LOCALE_SUMMARY_SQL = """
SELECT
    locale,
    count(*) FILTER (WHERE role = 'user')      AS user_messages,
    count(*) FILTER (WHERE role = 'assistant')  AS assistant_messages,
    avg(length(content)) FILTER (WHERE role = 'assistant') AS avg_assistant_length,
    min(length(content)) FILTER (WHERE role = 'assistant') AS min_assistant_length,
    max(length(content)) FILTER (WHERE role = 'assistant') AS max_assistant_length
FROM public.chat_messages
WHERE created_at >= $1
GROUP BY locale
ORDER BY locale;
"""

# Minimum acceptable assistant response length (characters).
MIN_RESPONSE_LENGTH = 20


async def _fetch_locale_summary(
    conn: asyncpg.Connection,
    since: datetime,
) -> list[dict[str, Any]]:
    """Per-locale aggregate statistics for messages since *since*."""
    rows = await conn.fetch(LOCALE_SUMMARY_SQL, since)
    return [
        {
            "locale": r["locale"] or "unknown",
            "user_messages": int(r["user_messages"]),
            "assistant_messages": int(r["assistant_messages"]),
            "avg_assistant_length": round(float(r["avg_assistant_length"] or 0), 1),
            "min_assistant_length": int(r["min_assistant_length"] or 0),
            "max_assistant_length": int(r["max_assistant_length"] or 0),
        }
        for r in rows
    ]


async def _fetch_flagged_responses(
    conn: asyncpg.Connection,
    since: datetime,
    min_length: int = MIN_RESPONSE_LENGTH,
) -> list[dict[str, Any]]:
    """Return assistant messages that are suspiciously short or empty."""
    rows = await conn.fetch(
        """
        SELECT conversation_id, content, locale, created_at
        FROM public.chat_messages
        WHERE role = 'assistant'
          AND created_at >= $1
          AND length(content) < $2
        ORDER BY created_at DESC
        LIMIT 50;
        """,
        since,
        min_length,
    )
    return [
        {
            "conversation_id": r["conversation_id"],
            "content": r["content"],
            "locale": r["locale"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "length": len(r["content"]) if r["content"] else 0,
        }
        for r in rows
    ]


async def _fetch_sample_exchanges(
    conn: asyncpg.Connection,
    since: datetime,
    per_locale: int = 3,
) -> dict[str, list[dict[str, str]]]:
    """Retrieve a handful of recent user→assistant exchanges for each locale."""
    samples: dict[str, list[dict[str, str]]] = {}
    for locale in ("en", "bn"):
        rows = await conn.fetch(
            """
            WITH ranked AS (
                SELECT
                    conversation_id,
                    role,
                    content,
                    created_at,
                    row_number() OVER (PARTITION BY conversation_id ORDER BY created_at) AS rn
                FROM public.chat_messages
                WHERE locale = $1
                  AND created_at >= $2
            )
            SELECT conversation_id, role, content
            FROM ranked
            WHERE rn <= 4
            ORDER BY conversation_id, rn
            LIMIT $3;
            """,
            locale,
            since,
            per_locale * 4,
        )
        exchanges: list[dict[str, str]] = []
        for r in rows:
            exchanges.append(
                {
                    "conversation_id": r["conversation_id"],
                    "role": r["role"],
                    "content": r["content"][:300],
                }
            )
        samples[locale] = exchanges
    return samples


async def generate_transcript_review(
    connection: asyncpg.Connection,
    since: datetime | None = None,
    include_samples: bool = True,
) -> dict[str, Any]:
    """Produce a structured transcript quality report for review.

    Args:
        connection: Active asyncpg database connection.
        since: Start of the review window (defaults to last 7 days).
        include_samples: Whether to include sample exchanges in the report.

    Returns:
        Dictionary with locale_summary, flagged_responses, and optionally samples.
    """
    if since is None:
        from datetime import timedelta
        since = datetime.now(timezone.utc) - timedelta(days=7)

    locale_summary = await _fetch_locale_summary(connection, since)
    flagged = await _fetch_flagged_responses(connection, since)

    report: dict[str, Any] = {
        "review_window_start": since.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "locale_summary": locale_summary,
        "flagged_short_responses": flagged,
        "total_flagged": len(flagged),
    }

    if include_samples:
        report["sample_exchanges"] = await _fetch_sample_exchanges(connection, since)

    # Compute a simple quality score per locale
    quality_scores: dict[str, str] = {}
    for ls in locale_summary:
        locale = ls["locale"]
        avg_len = ls["avg_assistant_length"]
        if avg_len >= 200:
            quality_scores[locale] = "good"
        elif avg_len >= 80:
            quality_scores[locale] = "acceptable"
        else:
            quality_scores[locale] = "needs_review"
    report["quality_assessment"] = quality_scores

    return report


async def run_transcript_review(database_url: str) -> dict[str, Any]:
    """Standalone entry point for CLI or scheduled job usage."""
    conn = await asyncpg.connect(database_url)
    try:
        return await generate_transcript_review(conn)
    finally:
        await conn.close()
