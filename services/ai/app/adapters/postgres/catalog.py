"""Published service catalog backed by Supabase Postgres."""

import asyncpg

from ...ports.catalog import ServiceCatalogItem


class PostgresCatalogRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def list_published_services(self, locale: str) -> list[ServiceCatalogItem]:
        is_bn = locale == "bn"
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT slug, name_en, name_bn, summary_en, summary_bn,
                       pricing_model, starting_from_usd
                FROM public.services
                WHERE is_published = true AND archived_at IS NULL
                ORDER BY sort_order, name_en;
                """
            )
        return [
            ServiceCatalogItem(
                slug=row["slug"],
                name=(row["name_bn"] if is_bn and row["name_bn"] else row["name_en"]),
                pricing_model=row["pricing_model"],
                starting_from_usd=(float(row["starting_from_usd"]) if row["starting_from_usd"] is not None else None),
                summary=(row["summary_bn"] if is_bn and row["summary_bn"] else row["summary_en"] or ""),
            )
            for row in rows
        ]
