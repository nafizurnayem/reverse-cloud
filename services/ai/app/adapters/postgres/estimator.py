"""Active estimator configuration backed by Supabase Postgres."""

from decimal import Decimal

import asyncpg

from ...ports.estimator import EstimatorConfig, EstimatorFactor


class PostgresEstimatorRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def get_active_config(self, service_slug: str) -> EstimatorConfig | None:
        async with self._pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                SELECT ev.id AS version_id, ev.version, ev.usd_to_bdt,
                       ev.bdt_multiplier, ev.rounding_step_usd,
                       s.id AS service_id, s.slug AS service_slug,
                       rate.base_min, rate.base_max, rate.weeks_min, rate.weeks_max
                FROM public.estimator_versions ev
                JOIN public.estimator_service_rates rate ON rate.version_id = ev.id
                JOIN public.services s ON s.id = rate.service_id
                WHERE ev.status = 'active'
                  AND s.slug = $1
                  AND s.is_published = true
                  AND s.archived_at IS NULL
                LIMIT 1;
                """,
                service_slug,
            )
            if row is None:
                return None
            factor_rows = await connection.fetch(
                """
                SELECT kind, key, multiplier, add_min, add_max,
                       add_weeks_min, add_weeks_max
                FROM public.estimator_factors
                WHERE version_id = $1
                  AND (service_id IS NULL OR service_id = $2)
                ORDER BY sort_order, kind, key;
                """,
                row["version_id"],
                row["service_id"],
            )
        factors = tuple(
            EstimatorFactor(
                kind=factor["kind"],
                key=factor["key"],
                multiplier=Decimal(factor["multiplier"]),
                add_min=Decimal(factor["add_min"]),
                add_max=Decimal(factor["add_max"]),
                add_weeks_min=int(factor["add_weeks_min"]),
                add_weeks_max=int(factor["add_weeks_max"]),
            )
            for factor in factor_rows
        )
        return EstimatorConfig(
            version_id=str(row["version_id"]),
            version=int(row["version"]),
            service_id=str(row["service_id"]),
            service_slug=row["service_slug"],
            base_min=Decimal(row["base_min"]),
            base_max=Decimal(row["base_max"]),
            weeks_min=int(row["weeks_min"]),
            weeks_max=int(row["weeks_max"]),
            usd_to_bdt=Decimal(row["usd_to_bdt"]),
            bdt_multiplier=Decimal(row["bdt_multiplier"]),
            rounding_step_usd=int(row["rounding_step_usd"]),
            factors=factors,
        )
