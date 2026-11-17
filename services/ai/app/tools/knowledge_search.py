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
from ..security.guardrails import detect_prompt_injection

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
        if detect_prompt_injection(content):
            logger.warning("Dropped suspicious retrieved chunk %s", r.get("chunk_id"))
            continue
        formatted_parts.append(
            f"[{idx}] Citation: {title} ({source})\n"
            f"<retrieved_knowledge>\n{content}\n</retrieved_knowledge>"
        )

    return "\n\n---\n\n".join(formatted_parts) or "No safe knowledge found for the query."


# Knowledge sources that belong to a website section the web app can disable.
SECTION_SOURCE_TYPES = {"service", "portfolio", "blog"}


def filter_disabled_sources(results: list[dict[str, Any]], deps: AgentDeps) -> list[dict[str, Any]]:
    """Drop results whose website section is disabled (e.g. blog posts after Blog is removed)."""
    return [
        r for r in results
        if r.get("source_type") not in SECTION_SOURCE_TYPES or deps.content_type_enabled(str(r.get("source_type")))
    ]


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

    top_k = max(1, min(top_k, 10))
    results = await hybrid_search(
        query=clean_query,
        pool=pool,
        # Over-fetch so removing disabled website sections still leaves enough results.
        top_k=top_k + 5 if ctx and ctx.deps.enabled_content_types is not None else top_k,
        locale=locale,
        embedder=embedder,
    )
    if ctx:
        results = filter_disabled_sources(results, ctx.deps)

    return format_search_results(results[:top_k])
