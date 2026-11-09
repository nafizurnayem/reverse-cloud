"""Estimator configuration repository boundary."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass(frozen=True)
class EstimatorFactor:
    kind: str
    key: str
    multiplier: Decimal
    add_min: Decimal
    add_max: Decimal
    add_weeks_min: int
    add_weeks_max: int


@dataclass(frozen=True)
class EstimatorConfig:
    version_id: str
    version: int
    service_id: str
    service_slug: str
    base_min: Decimal
    base_max: Decimal
    weeks_min: int
    weeks_max: int
    usd_to_bdt: Decimal
    bdt_multiplier: Decimal
    rounding_step_usd: int
    factors: tuple[EstimatorFactor, ...]


class EstimatorRepository(Protocol):
    async def get_active_config(self, service_slug: str) -> EstimatorConfig | None: ...
