"""Project estimate tool using active Supabase configuration when available."""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from pydantic_ai import RunContext

from ..adapters.postgres.estimator import PostgresEstimatorRepository
from ..agents.deps import AgentDeps
from ..estimator.engine import EstimateInput, estimate_project
from ..ports.estimator import EstimatorConfig, EstimatorRepository

logger = logging.getLogger(__name__)

PROJECT_SERVICE_SLUGS = {
    "web": "website-development",
    "automation": "ai-automation",
    "ai": "ai-chatbots-agents",
    "scraping": "software-development",
    "custom": "system-architecture-design",
}


def _round_to_step(value: Decimal, step: int) -> int:
    units = (value / Decimal(step)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(units * step)


def configured_estimate(
    config: EstimatorConfig,
    *,
    complexity: str,
    integrations: int,
    features: list[str],
    timeline_weeks: int | None,
) -> dict[str, object]:
    """Apply an active database version without coupling calculation to async I/O."""
    minimum = config.base_min
    maximum = config.base_max
    weeks_min = config.weeks_min
    weeks_max = config.weeks_max
    selected = {feature.strip().lower() for feature in features}
    applicable = [
        factor
        for factor in config.factors
        if (factor.kind == "complexity" and factor.key == complexity)
        or (factor.kind == "addon" and factor.key in selected)
    ]
    integration_factor = next((factor for factor in config.factors if factor.kind == "integration"), None)
    if integrations > 0 and integration_factor is not None:
        applicable.extend([integration_factor] * integrations)

    for factor in applicable:
        minimum = minimum * factor.multiplier + factor.add_min
        maximum = maximum * factor.multiplier + factor.add_max
        weeks_min += factor.add_weeks_min
        weeks_max += factor.add_weeks_max

    if timeline_weeks is not None:
        weeks_min = weeks_max = timeline_weeks
    min_usd = _round_to_step(minimum, config.rounding_step_usd)
    max_usd = max(min_usd, _round_to_step(maximum, config.rounding_step_usd))
    bdt_rate = config.usd_to_bdt * config.bdt_multiplier
    return {
        "source": "supabase",
        "estimator_version": config.version,
        "service_slug": config.service_slug,
        "currency": "USD",
        "min_usd": min_usd,
        "max_usd": max_usd,
        "min_bdt": int(Decimal(min_usd) * bdt_rate),
        "max_bdt": int(Decimal(max_usd) * bdt_rate),
        "weeks_min": weeks_min,
        "weeks_max": max(weeks_min, weeks_max),
        "timeline_weeks": max(weeks_min, weeks_max),
        "assumptions": [
            "Calculated from the active Supabase estimator version.",
            "Final scope is confirmed after a discovery call.",
        ],
    }


async def get_estimate(
    ctx: RunContext[AgentDeps],
    project_type: Literal["web", "automation", "ai", "scraping", "custom"] = "web",
    complexity: Literal["simple", "standard", "complex"] = "standard",
    pages: int = 1,
    integrations: int = 0,
    features: list[str] | None = None,
    timeline_weeks: int | None = None,
    service_slug: str | None = None,
) -> dict[str, object]:
    """Calculate an estimate, preferring the active Supabase estimator version."""
    repository: EstimatorRepository | None = ctx.deps.estimator_repository
    if repository is None and ctx.deps.db_pool is not None:
        repository = PostgresEstimatorRepository(ctx.deps.db_pool)
    resolved_slug = service_slug or PROJECT_SERVICE_SLUGS[project_type]

    if repository is not None:
        try:
            config = await repository.get_active_config(resolved_slug)
            if config is not None:
                return configured_estimate(
                    config,
                    complexity=complexity,
                    integrations=max(0, integrations),
                    features=features or [],
                    timeline_weeks=timeline_weeks,
                )
        except Exception:
            logger.exception("Could not load active Supabase estimator; using deterministic fallback")

    try:
        fallback = estimate_project(
            EstimateInput(
                project_type=project_type,
                complexity=complexity,
                pages=max(1, pages),
                integrations=max(0, integrations),
                features=tuple(features or []),
                timeline_weeks=timeline_weeks,
            )
        ).as_dict()
        return {"source": "offline_fallback", "service_slug": resolved_slug, **fallback}
    except ValueError as error:
        return {"status": "error", "message": str(error)}
