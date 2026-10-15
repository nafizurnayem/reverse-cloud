"""AI cost and token usage monitoring and alerts (plan section 4.6)."""

from __future__ import annotations

import html
import logging
from typing import Any

import asyncpg
import httpx

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

DAILY_USAGE_SQL = """
select
  coalesce(sum(tokens_in), 0)::bigint as total_tokens_in,
  coalesce(sum(tokens_out), 0)::bigint as total_tokens_out,
  coalesce(sum(tokens_in + tokens_out), 0)::bigint as total_tokens
from public.chat_messages
where created_at >= date_trunc('day', now() at time zone 'UTC');
"""


async def get_daily_token_usage(connection: asyncpg.Connection) -> dict[str, int]:
    """Retrieve the sum of tokens consumed today in UTC."""
    row = await connection.fetchrow(DAILY_USAGE_SQL)
    if not row:
        return {"tokens_in": 0, "tokens_out": 0, "total": 0}
    return {
        "tokens_in": int(row["total_tokens_in"]),
        "tokens_out": int(row["total_tokens_out"]),
        "total": int(row["total_tokens"]),
    }


async def send_token_alert(
    client: httpx.AsyncClient,
    settings: Settings,
    usage: dict[str, int],
    threshold_percent: int,
) -> bool:
    """Dispatch an alert to staff when token usage crosses a threshold."""
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return False

    budget = settings.ai_daily_token_budget
    total = usage["total"]
    pct = round((total / budget) * 100, 1) if budget > 0 else 0

    severity = "🚨 CRITICAL" if pct >= 100 else "⚠️ WARNING"
    text = (
        f"{severity}: <b>AI Token Usage Alert</b>\n"
        f"Daily Budget: <b>{budget:,} tokens</b>\n"
        f"Consumed Today: <b>{total:,} tokens</b> ({pct}%)\n"
        f"Tokens In: {usage['tokens_in']:,} | Tokens Out: {usage['tokens_out']:,}\n"
    )
    if pct >= 100:
        text += "\n<b>Action:</b> Daily budget exhausted. Rate limiting or fallback is active."

    try:
        response = await client.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
            json={
                "chat_id": settings.telegram_chat_id,
                "text": text,
                "parse_mode": "HTML",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logger.warning("Failed to send token alert to Telegram: %s", exc)
        return False


async def check_and_alert_token_usage(settings: Settings | None = None) -> dict[str, Any]:
    """Check current daily token consumption and send alerts if >= 80% or >= 100%."""
    settings = settings or get_settings()
    if not settings.database_url:
        return {"status": "skipped", "reason": "no database url"}

    connection = await asyncpg.connect(settings.database_url)
    try:
        usage = await get_daily_token_usage(connection)
        budget = settings.ai_daily_token_budget
        pct = (usage["total"] / budget) * 100 if budget > 0 else 0

        alerted = False
        if pct >= 80:
            async with httpx.AsyncClient() as client:
                alerted = await send_token_alert(client, settings, usage, int(pct))

        return {
            "status": "ok",
            "usage": usage,
            "budget": budget,
            "percent_used": pct,
            "alerted": alerted,
        }
    finally:
        await connection.close()
