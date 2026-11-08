"""Periodic token-budget monitoring for the self-hosted AI service."""

from __future__ import annotations

import asyncio
from datetime import date
import logging

import asyncpg
import httpx

from ..config import get_settings
from .token_alerts import get_daily_token_usage, send_token_alert

logger = logging.getLogger(__name__)


def alert_band(total: int, budget: int) -> int:
    if budget > 0 and total >= budget:
        return 100
    if budget > 0 and total >= budget * 0.8:
        return 80
    return 0


async def main(interval_seconds: int = 300) -> None:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL_AI is required")
    notified_day = date.today()
    notified_band = 0

    while True:
        try:
            connection = await asyncpg.connect(settings.database_url)
            try:
                usage = await get_daily_token_usage(connection)
            finally:
                await connection.close()

            today = date.today()
            if today != notified_day:
                notified_day, notified_band = today, 0
            band = alert_band(usage["total"], settings.ai_daily_token_budget)
            logger.info(
                "AI daily usage tokens=%s budget=%s percent=%.1f",
                usage["total"],
                settings.ai_daily_token_budget,
                (usage["total"] / settings.ai_daily_token_budget) * 100,
            )
            if band > notified_band:
                async with httpx.AsyncClient() as client:
                    await send_token_alert(client, settings, usage, band)
                notified_band = band
        except Exception:
            logger.exception("AI usage monitor failed; retrying")
        await asyncio.sleep(interval_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(main())
