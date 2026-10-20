"""Knowledge search tool for Reverse Cloud AI agent.

Executes hybrid semantic vector and keyword search across verified company documentation,
technical case studies, policies, and service details.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic_ai import RunContext

from ..agents.deps import AgentDeps
from ..retrieval.search import hybrid_search

logger = logging.getLogger(__name__)


def format_search_results(results: list[dict[str, Any]]) -> str:
    """Format search chunk results into clear markdown for the agent context."""
    if not results:
        return "No relevant knowledge found for the query."

    formatted_parts: list[str] = []
    for idx, r in enumerate(results, 1):
        title = r.get("document_title", "General Information")
        source = r.get("source_type", "document")
        content = r.get("content", "").strip()
        formatted_parts.append(f"[{idx}] {title} ({source}):\n{content}")

    return "\n\n---\n\n".join(formatted_parts)


async def search_knowledge(
    ctx: RunContext[AgentDeps],
    query: str,
    top_k: int = 5,
) -> str:
    """Search verified documentation and knowledge base for Reverse Cloud information.

    Use this tool whenever users ask specific questions about Reverse Cloud policies,
    technologies, past portfolio work, or detailed service specifics.

    Args:
        ctx: Agent run context containing database pool and embedder.
        query: The search keywords or natural language question.
        top_k: Number of relevant knowledge chunks to retrieve (default 5).

    Returns:
        Formatted string of relevant knowledge excerpts, or notice if none found.
    """
    clean_query = query.strip()
    if not clean_query:
        return "Please specify a query to search the knowledge base."

    pool = ctx.deps.db_pool if ctx else None
    locale = ctx.deps.locale if ctx else "en"
    embedder = ctx.deps.embedder if ctx else None

    results = await hybrid_search(
        query=clean_query,
        pool=pool,
        top_k=top_k,
        locale=locale,
        embedder=embedder,
    )

    return format_search_results(results)
