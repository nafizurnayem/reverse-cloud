"""Deterministic project estimation rules.

The engine deliberately has no I/O, framework, or model dependencies so its
outputs can be treated as a stable pricing contract.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Mapping


PROJECT_TYPES = {"web", "automation", "ai", "scraping", "custom"}
COMPLEXITY_MULTIPLIERS = {
    "simple": Decimal("0.80"),
    "standard": Decimal("1.00"),
    "complex": Decimal("1.35"),
}
BASE_HOURS = {
    "web": Decimal("40"),
    "automation": Decimal("24"),
    "ai": Decimal("56"),
    "scraping": Decimal("32"),
    "custom": Decimal("48"),
}
FEATURE_HOURS = {
    "auth": Decimal("8"),
    "payments": Decimal("16"),
    "admin": Decimal("12"),
    "notifications": Decimal("8"),
    "analytics": Decimal("10"),
    "multilingual": Decimal("12"),
}
HOURLY_RATE_USD = Decimal("45")
CONTINGENCY = Decimal("0.15")


@dataclass(frozen=True)
class EstimateInput:
    project_type: str
    complexity: str = "standard"
    pages: int = 1
    integrations: int = 0
    features: tuple[str, ...] = ()
    timeline_weeks: int | None = None


@dataclass(frozen=True)
class Estimate:
    currency: str
    min_usd: int
    max_usd: int
    min_hours: int
    max_hours: int
    timeline_weeks: int
    assumptions: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "currency": self.currency,
            "min_usd": self.min_usd,
            "max_usd": self.max_usd,
            "min_hours": self.min_hours,
            "max_hours": self.max_hours,
            "timeline_weeks": self.timeline_weeks,
            "assumptions": list(self.assumptions),
        }


def _round_up(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def estimate_project(request: EstimateInput) -> Estimate:
    """Return a repeatable range from a normalized estimate request."""
    project_type = request.project_type.lower().strip()
    complexity = request.complexity.lower().strip()
    if project_type not in PROJECT_TYPES:
        raise ValueError(f"unsupported project_type: {request.project_type}")
    if complexity not in COMPLEXITY_MULTIPLIERS:
        raise ValueError(f"unsupported complexity: {request.complexity}")
    if not 1 <= request.pages <= 100:
        raise ValueError("pages must be between 1 and 100")
    if not 0 <= request.integrations <= 20:
        raise ValueError("integrations must be between 0 and 20")
    if request.timeline_weeks is not None and not 1 <= request.timeline_weeks <= 52:
        raise ValueError("timeline_weeks must be between 1 and 52")

    feature_hours = sum(
        (FEATURE_HOURS.get(feature.lower().strip(), Decimal("6")) for feature in request.features),
        Decimal("0"),
    )
    raw_hours = (
        BASE_HOURS[project_type]
        + Decimal(request.pages - 1) * Decimal("4")
        + Decimal(request.integrations) * Decimal("10")
        + feature_hours
    ) * COMPLEXITY_MULTIPLIERS[complexity]
    min_hours = _round_up(raw_hours * (Decimal("1") + CONTINGENCY))
    max_hours = _round_up(raw_hours * (Decimal("1") + CONTINGENCY + Decimal("0.20")))
    timeline = request.timeline_weeks or max(2, _round_up(Decimal(max_hours) / Decimal("24")))

    return Estimate(
        currency="USD",
        min_usd=_round_up(Decimal(min_hours) * HOURLY_RATE_USD),
        max_usd=_round_up(Decimal(max_hours) * HOURLY_RATE_USD),
        min_hours=min_hours,
        max_hours=max_hours,
        timeline_weeks=timeline,
        assumptions=(
            "Estimate excludes third-party subscription fees and taxes.",
            "Final scope is confirmed after a discovery call.",
        ),
    )


def estimate_from_mapping(payload: Mapping[str, object]) -> Estimate:
    """Build an estimate from JSON-like input without coupling the engine to Pydantic."""
    features = payload.get("features", [])
    if not isinstance(features, list) or not all(isinstance(item, str) for item in features):
        raise ValueError("features must be a list of strings")
    return estimate_project(
        EstimateInput(
            project_type=str(payload.get("project_type", "")),
            complexity=str(payload.get("complexity", "standard")),
            pages=int(payload.get("pages", 1)),
            integrations=int(payload.get("integrations", 0)),
            features=tuple(features),
            timeline_weeks=(
                int(payload["timeline_weeks"])
                if payload.get("timeline_weeks") is not None
                else None
            ),
        )
    )
