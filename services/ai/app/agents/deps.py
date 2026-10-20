"""Dependencies injected into PydanticAI agent runs and tool executions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import asyncpg

from ..retrieval.ingest import Embedder


@dataclass
class AgentDeps:
    """Runtime dependencies for PydanticAI agent and tools."""

    db_pool: asyncpg.Pool | None = None
    locale: str = "en"
    conversation_id: str | None = None
    embedder: Embedder | None = None
    client_id: str | None = None
    calcom_api_key: str | None = None
    handoff_requested: bool = False
    handoff_details: dict[str, Any] = field(default_factory=dict)
