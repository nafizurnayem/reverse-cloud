"""Unit tests for cost report module (Phase 5, Wave 1)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.config import Settings
from app.jobs.cost_report import _estimate_cost, generate_cost_report


def test_estimate_cost_gpt4o_mini() -> None:
    # 1M input + 1M output at gpt-4o-mini pricing
    cost = _estimate_cost(1_000_000, 1_000_000, "gpt-4o-mini")
    # $0.15/M input + $0.60/M output = $0.75
    assert cost == 0.75


def test_estimate_cost_gpt4o() -> None:
    cost = _estimate_cost(500_000, 500_000, "gpt-4o")
    # $2.50/2 input + $10.00/2 output = $1.25 + $5.00 = $6.25
    assert cost == 6.25


def test_estimate_cost_unknown_model_uses_default() -> None:
    cost = _estimate_cost(1_000_000, 1_000_000, "unknown-model-v9")
    # default: $0.50/M input + $1.50/M output = $2.00
    assert cost == 2.0


def test_estimate_cost_zero_tokens() -> None:
    cost = _estimate_cost(0, 0, "gpt-4o-mini")
    assert cost == 0.0


@pytest.mark.asyncio
async def test_generate_cost_report() -> None:
    settings = Settings(
        llm_model="gpt-4o-mini",
        ai_daily_token_budget=100_000,
    )

    mock_conn = AsyncMock()

    # today's usage
    mock_conn.fetchrow = AsyncMock(
        return_value={
            "total_tokens_in": 30_000,
            "total_tokens_out": 10_000,
            "total_tokens": 40_000,
            "message_count": 25,
        }
    )

    # daily breakdown
    mock_conn.fetch = AsyncMock(
        return_value=[
            {
                "usage_date": datetime(2026, 10, 22).date(),
                "total_tokens_in": 30_000,
                "total_tokens_out": 10_000,
                "message_count": 25,
            },
            {
                "usage_date": datetime(2026, 10, 21).date(),
                "total_tokens_in": 50_000,
                "total_tokens_out": 20_000,
                "message_count": 40,
            },
        ]
    )

    since = datetime(2026, 10, 1, tzinfo=timezone.utc)
    report = await generate_cost_report(mock_conn, since=since, settings=settings)

    assert report["model"] == "gpt-4o-mini"
    assert report["daily_token_budget"] == 100_000
    assert report["today"]["total_tokens"] == 40_000
    assert report["today"]["budget_used_pct"] == 40.0
    assert report["today"]["estimated_cost_usd"] > 0

    assert report["period"]["days_reported"] == 2
    assert report["period"]["total_tokens"] == 110_000
    assert report["period"]["estimated_cost_usd"] > 0
    assert len(report["daily_breakdown"]) == 2


@pytest.mark.asyncio
async def test_generate_cost_report_empty_database() -> None:
    settings = Settings(
        llm_model="gpt-4o-mini",
        ai_daily_token_budget=1_000_000,
    )

    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.fetch = AsyncMock(return_value=[])

    since = datetime(2026, 10, 1, tzinfo=timezone.utc)
    report = await generate_cost_report(mock_conn, since=since, settings=settings)

    assert report["today"]["total_tokens"] == 0
    assert report["today"]["estimated_cost_usd"] == 0.0
    assert report["period"]["days_reported"] == 0
    assert report["period"]["total_tokens"] == 0
