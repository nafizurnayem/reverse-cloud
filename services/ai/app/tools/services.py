"""Dynamic services catalog tool backed by published Supabase content."""

from __future__ import annotations

import logging
from typing import Literal

from pydantic_ai import RunContext

from ..adapters.postgres.catalog import PostgresCatalogRepository
from ..adapters.static.catalog import static_services
from ..agents.deps import AgentDeps

logger = logging.getLogger(__name__)


def get_services_catalog(
    locale: str = "en",
) -> list[dict[str, object]]:
    """Return the synchronous offline catalog for compatibility and local use."""
    return [item.as_dict() for item in static_services(locale)]


async def list_services(
    ctx: RunContext[AgentDeps],
    locale: Literal["en", "bn"] | None = None,
) -> list[dict[str, object]]:
    """List the current published Supabase services in the requested locale."""
    effective_locale = locale or ctx.deps.locale
    repository = ctx.deps.catalog_repository
    if repository is None and ctx.deps.db_pool is not None:
        repository = PostgresCatalogRepository(ctx.deps.db_pool)

    if repository is not None:
        try:
            services = await repository.list_published_services(effective_locale)
            if services:
                return [service.as_dict() for service in services]
            logger.warning("Supabase has no published services; using offline catalog fallback")
        except Exception:
            logger.exception("Could not load the Supabase services catalog; using offline fallback")

    return get_services_catalog(effective_locale)
