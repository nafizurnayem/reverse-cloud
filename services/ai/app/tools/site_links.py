"""Navigation links from the chat to verified website pages.

The tool never builds URLs. It returns section keys and published content
slugs; the web app maps them to paths using its shared section list and checks
each one again before rendering. Sections the web app did not enable are
dropped here first.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic_ai import RunContext

from ..adapters.static.catalog import static_services
from ..agents.deps import AgentDeps

logger = logging.getLogger(__name__)

MAX_LINKS = 4
MAX_REFS_PER_KIND = 4

# Published-content lookups. Each matches by slug or by exact (case-insensitive) title.
CONTENT_SQL: dict[str, str] = {
    "service": """
        SELECT slug, name_en AS title_en, name_bn AS title_bn
        FROM public.services
        WHERE is_published = true AND archived_at IS NULL
          AND (slug = ANY($1::text[]) OR lower(name_en) = ANY($2::text[]) OR lower(name_bn) = ANY($2::text[]))
    """,
    "portfolio": """
        SELECT slug, title_en, title_bn
        FROM public.portfolio_items
        WHERE is_published = true AND client_consent = true
          AND (slug = ANY($1::text[]) OR lower(title_en) = ANY($2::text[]) OR lower(title_bn) = ANY($2::text[]))
    """,
    "blog": """
        SELECT slug, title_en, title_bn
        FROM public.blog_posts
        WHERE status = 'published'
          AND (slug = ANY($1::text[]) OR lower(title_en) = ANY($2::text[]) OR lower(title_bn) = ANY($2::text[]))
    """,
}


def _clean_refs(values: list[str] | None) -> list[str]:
    refs: list[str] = []
    for value in values or []:
        if isinstance(value, str) and (cleaned := " ".join(value.split())) and len(cleaned) <= 200:
            refs.append(cleaned)
    return refs[:MAX_REFS_PER_KIND]


def _title(row: dict[str, Any], locale: str) -> str:
    if locale == "bn" and row.get("title_bn"):
        return str(row["title_bn"])
    return str(row.get("title_en") or row.get("slug"))


async def _published_items(ctx: RunContext[AgentDeps], kind: str, refs: list[str]) -> list[dict[str, Any]]:
    if not refs:
        return []
    lowered = [ref.lower() for ref in refs]
    pool = ctx.deps.db_pool
    if pool is None:
        # Offline fallback: only the static service catalog is available.
        if kind != "service":
            return []
        return [
            {"slug": item.slug, "title_en": item.name, "title_bn": item.name}
            for item in static_services(ctx.deps.locale)
            if item.slug in refs or item.name.lower() in lowered
        ]
    try:
        async with pool.acquire() as connection:
            rows = await connection.fetch(CONTENT_SQL[kind], refs, lowered)
        return [dict(row) for row in rows]
    except Exception:
        logger.exception("Could not verify %s links", kind)
        return []


async def suggest_pages(
    ctx: RunContext[AgentDeps],
    sections: list[str] | None = None,
    services: list[str] | None = None,
    portfolio: list[str] | None = None,
    blog: list[str] | None = None,
) -> dict[str, Any]:
    """Show the visitor clickable links to relevant pages of the Reverse Cloud website.

    Call this whenever you mention a specific service, portfolio project, blog article,
    or a page such as pricing, schedule or contact, so the visitor can open it.
    Only published content and enabled website sections are linked.

    Args:
        ctx: Agent run context.
        sections: Website section keys to link, e.g. ["pricing", "schedule"].
        services: Service slugs or exact service names.
        portfolio: Portfolio project slugs or exact project titles.
        blog: Blog article slugs or exact article titles.

    Returns:
        The verified links shown to the visitor, or an error when none could be verified.
    """
    deps = ctx.deps
    links: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    def add(link: dict[str, Any]) -> None:
        key = (link["kind"], link.get("slug") or link.get("section", ""))
        if key not in seen and len(links) < MAX_LINKS:
            seen.add(key)
            links.append(link)

    for kind, refs in (("service", services), ("portfolio", portfolio), ("blog", blog)):
        if not deps.content_type_enabled(kind):
            continue
        for row in await _published_items(ctx, kind, _clean_refs(refs)):
            add({"kind": kind, "slug": str(row["slug"]), "title": _title(row, deps.locale)})

    for section in _clean_refs(sections):
        key = section.lower()
        if key.isidentifier() and deps.section_enabled(key) and deps.enabled_sections is not None:
            add({"kind": "section", "section": key})

    if not links:
        return {
            "error": "no_valid_links",
            "message": "None of those pages could be verified. Describe them without a link.",
        }
    return {"links": links}
