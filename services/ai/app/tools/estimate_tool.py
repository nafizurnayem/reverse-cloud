"""Deterministic project estimation tool for Reverse Cloud AI agent.

Provides instant price and timeline estimates by running the deterministic
rules engine in app.estimator.engine without hallucinations.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic_ai import RunContext

from ..agents.deps import AgentDeps
from ..estimator.engine import EstimateInput, estimate_project


async def get_estimate(
    project_type: Literal["web", "automation", "ai", "scraping", "custom"] = "web",
    complexity: Literal["simple", "standard", "complex"] = "standard",
    pages: int = 1,
    integrations: int = 0,
    features: list[str] | None = None,
    timeline_weeks: int | None = None,
) -> dict[str, Any]:
    """Calculate an instant deterministic cost and timeline estimate for a prospective project.

    Args:
        project_type: Primary project category ('web', 'automation', 'ai', 'scraping', 'custom').
        complexity: Level of scope complexity ('simple', 'standard', 'complex').
        pages: Estimated number of distinct pages/screens (minimum 1).
        integrations: Number of third-party external APIs or services to integrate (minimum 0).
        features: Specific optional feature flags (e.g. ['auth', 'payments', 'admin', 'notifications', 'analytics', 'multilingual']).
        timeline_weeks: Optional client target delivery timeframe in weeks.

    Returns:
        Structured estimate containing min_usd, max_usd, min_hours, max_hours, timeline_weeks, and assumptions.
    """
    valid_pages = max(1, pages)
    valid_integrations = max(0, integrations)
    tuple_features = tuple(features or [])

    try:
        estimate = estimate_project(
            EstimateInput(
                project_type=project_type,
                complexity=complexity,
                pages=valid_pages,
                integrations=valid_integrations,
                features=tuple_features,
                timeline_weeks=timeline_weeks,
            )
        )
        return estimate.as_dict()
    except ValueError as exc:
        return {
            "error": str(exc),
            "message": "Invalid estimation parameters provided.",
        }
