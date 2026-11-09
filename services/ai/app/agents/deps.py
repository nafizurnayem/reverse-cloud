"""Dependencies injected into PydanticAI agent runs and tool executions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import asyncpg

from ..retrieval.ingest import Embedder

if TYPE_CHECKING:
    from ..ports.catalog import CatalogRepository
    from ..ports.estimator import EstimatorRepository


@dataclass
class AgentDeps:
    """Runtime dependencies for PydanticAI agent and tools."""

    db_pool: asyncpg.Pool | None = None
    locale: str = "en"
    conversation_id: str | None = None
    embedder: Embedder | None = None
    catalog_repository: CatalogRepository | None = None
    estimator_repository: EstimatorRepository | None = None
    client_id: str | None = None
    calcom_api_key: str | None = None
    sensitive_action_confirmed: bool = False
    handoff_requested: bool = False
    handoff_details: dict[str, Any] = field(default_factory=dict)
