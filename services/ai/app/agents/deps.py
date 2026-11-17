"""Dependencies injected into PydanticAI agent runs and tool executions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import asyncpg

from ..retrieval.ingest import Embedder

if TYPE_CHECKING:
    from ..ports.catalog import CatalogRepository
    from ..ports.estimator import EstimatorRepository
    from ..schemas.chat import PageContext


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
    page_context: PageContext | None = None
    # None means "not restricted" (the web app did not send its section list).
    enabled_sections: list[str] | None = None
    enabled_content_types: list[str] | None = None

    def section_enabled(self, section: str) -> bool:
        return self.enabled_sections is None or section in self.enabled_sections

    def content_type_enabled(self, content_type: str) -> bool:
        return self.enabled_content_types is None or content_type in self.enabled_content_types
