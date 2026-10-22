"""AI cost-vs-budget reporting (Phase 5, Wave 1).

Queries token usage from chat_messages, computes estimated dollar cost using
OpenAI pricing tiers, and produces a structured cost report comparing actual
spend against the configured daily token budget.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import asyncpg

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

# ── OpenAI pricing (per 1M tokens, as of 2026) ──
MODEL_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
}
DEFAULT_PRICING = {"input": 0.50, "output": 1.50}

DAILY_BREAKDOWN_SQL = """
SELECT
    date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS usage_date,
    coalesce(sum(tokens_in), 0)::bigint  AS total_tokens_in,
    coalesce(sum(tokens_out), 0)::bigint AS total_tokens_out,
    count(*)::integer                    AS message_count
FROM public.chat_messages
WHERE created_at >= $1
GROUP BY usage_date
ORDER BY usage_date DESC;
"""

TODAY_USAGE_SQL = """
SELECT
    coalesce(sum(tokens_in), 0)::bigint              AS total_tokens_in,
    coalesce(sum(tokens_out), 0)::bigint             AS total_tokens_out,
    coalesce(sum(tokens_in + tokens_out), 0)::bigint AS total_tokens,
    count(*)::integer                                AS message_count
FROM public.chat_messages
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
"""


def _estimate_cost(
    tokens_in: int,
    tokens_out: int,
    model: str = "gpt-4o-mini",
) -> float:
    """Estimate dollar cost for given token counts."""
    pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
    cost_in = (tokens_in / 1_000_000) * pricing["input"]
    cost_out = (tokens_out / 1_000_000) * pricing["output"]
    return round(cost_in + cost_out, 4)


async def generate_cost_report(
    connection: asyncpg.Connection,
    since: datetime | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Produce a structured cost-vs-budget report.

    Args:
        connection: Active asyncpg connection (should use ai_service role).
        since: Start of reporting window (defaults to last 30 days).
        settings: Application settings for budget and model info.

    Returns:
        Dictionary with today's usage, daily breakdown, estimated costs,
        and budget utilisation percentage.
    """
    settings = settings or get_settings()

    if since is None:
        from datetime import timedelta
        since = datetime.now(timezone.utc) - timedelta(days=30)

    model = settings.llm_model
    budget = settings.ai_daily_token_budget

    # Today's usage
    today_row = await connection.fetchrow(TODAY_USAGE_SQL)
    today = {
        "tokens_in": int(today_row["total_tokens_in"]) if today_row else 0,
        "tokens_out": int(today_row["total_tokens_out"]) if today_row else 0,
        "total_tokens": int(today_row["total_tokens"]) if today_row else 0,
        "message_count": int(today_row["message_count"]) if today_row else 0,
    }
    today["estimated_cost_usd"] = _estimate_cost(today["tokens_in"], today["tokens_out"], model)
    today["budget_used_pct"] = round((today["total_tokens"] / budget) * 100, 1) if budget > 0 else 0

    # Daily breakdown
    rows = await connection.fetch(DAILY_BREAKDOWN_SQL, since)
    daily_breakdown: list[dict[str, Any]] = []
    total_in = 0
    total_out = 0
    for r in rows:
        t_in = int(r["total_tokens_in"])
        t_out = int(r["total_tokens_out"])
        total_in += t_in
        total_out += t_out
        daily_breakdown.append(
            {
                "date": str(r["usage_date"]),
                "tokens_in": t_in,
                "tokens_out": t_out,
                "total_tokens": t_in + t_out,
                "estimated_cost_usd": _estimate_cost(t_in, t_out, model),
                "message_count": int(r["message_count"]),
            }
        )

    period_cost = _estimate_cost(total_in, total_out, model)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "daily_token_budget": budget,
        "today": today,
        "period": {
            "since": since.isoformat(),
            "total_tokens_in": total_in,
            "total_tokens_out": total_out,
            "total_tokens": total_in + total_out,
            "estimated_cost_usd": period_cost,
            "days_reported": len(daily_breakdown),
        },
        "daily_breakdown": daily_breakdown,
    }


async def run_cost_report(database_url: str) -> dict[str, Any]:
    """Standalone entry point for CLI or scheduled job usage."""
    conn = await asyncpg.connect(database_url)
    try:
        return await generate_cost_report(conn)
    finally:
        await conn.close()
