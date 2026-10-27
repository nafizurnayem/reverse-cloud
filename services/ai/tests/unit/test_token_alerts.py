from unittest.mock import AsyncMock, MagicMock
import httpx
import pytest

from app.config import Settings
from app.jobs.token_alerts import get_daily_token_usage, send_token_alert


@pytest.mark.asyncio
async def test_get_daily_token_usage() -> None:
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "total_tokens_in": 5000,
            "total_tokens_out": 2000,
            "total_tokens": 7000,
        }
    )
    usage = await get_daily_token_usage(conn)
    assert usage["tokens_in"] == 5000
    assert usage["tokens_out"] == 2000
    assert usage["total"] == 7000


@pytest.mark.asyncio
async def test_send_token_alert_warning() -> None:
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    client = AsyncMock(spec=httpx.AsyncClient)
    client.post = AsyncMock(return_value=mock_response)
    settings = Settings(
        telegram_bot_token="token",
        telegram_chat_id="chat",
        ai_daily_token_budget=10_000,
    )
    usage = {"tokens_in": 6000, "tokens_out": 2500, "total": 8500}

    success = await send_token_alert(client, settings, usage, 85)
    assert success is True
    client.post.assert_awaited_once()
    payload = client.post.call_args[1]["json"]
    assert "⚠️ WARNING: <b>AI Token Usage Alert</b>" in payload["text"]
    assert "85.0%" in payload["text"]


@pytest.mark.asyncio
async def test_send_token_alert_critical() -> None:
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    client = AsyncMock(spec=httpx.AsyncClient)
    client.post = AsyncMock(return_value=mock_response)

    settings = Settings(
        telegram_bot_token="token",
        telegram_chat_id="chat",
        ai_daily_token_budget=10_000,
    )
    usage = {"tokens_in": 8000, "tokens_out": 3000, "total": 11000}

    success = await send_token_alert(client, settings, usage, 110)
    assert success is True
    client.post.assert_awaited_once()
    payload = client.post.call_args[1]["json"]
    assert "🚨 CRITICAL: <b>AI Token Usage Alert</b>" in payload["text"]
    assert "Daily budget exhausted" in payload["text"]


def test_daily_usage_sql_utc_timestamptz() -> None:
    from app.jobs.token_alerts import DAILY_USAGE_SQL
    # Verify the SQL query explicitly constructs UTC timestamptz regardless of session timezone (e.g. +06:00)
    assert "date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'" in DAILY_USAGE_SQL

