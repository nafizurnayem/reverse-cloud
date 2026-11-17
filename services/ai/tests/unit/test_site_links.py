"""Unit tests for verified website links and section-aware knowledge filtering."""

from __future__ import annotations

from contextlib import asynccontextmanager

import pytest

from app.agents.deps import AgentDeps
from app.tools.knowledge_search import filter_disabled_sources
from app.tools.site_links import MAX_LINKS, suggest_pages

ALL_SECTIONS = ["home", "services", "portfolio", "pricing", "blog", "contact", "schedule"]


class Ctx:
    def __init__(self, deps: AgentDeps) -> None:
        self.deps = deps


class FakeConnection:
    def __init__(self, rows_by_table: dict[str, list[dict]]) -> None:
        self.rows_by_table = rows_by_table
        self.calls: list[tuple[str, list[str], list[str]]] = []

    async def fetch(self, sql: str, slugs: list[str], titles: list[str]):
        table = next(name for name in self.rows_by_table if f"public.{name}" in sql)
        self.calls.append((table, slugs, titles))
        return [
            row for row in self.rows_by_table[table]
            if row["slug"] in slugs or row["title_en"].lower() in titles
        ]


class FakePool:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    @asynccontextmanager
    async def acquire(self):
        yield self.connection


def deps(**overrides) -> AgentDeps:
    values = {"locale": "en", "enabled_sections": ALL_SECTIONS, "enabled_content_types": ["service", "portfolio", "blog"]}
    values.update(overrides)
    return AgentDeps(**values)


def published_pool() -> FakePool:
    return FakePool(FakeConnection({
        "services": [{"slug": "ai-automation", "title_en": "AI Automation", "title_bn": "এআই অটোমেশন"}],
        "portfolio_items": [{"slug": "shop-app", "title_en": "Shop App", "title_bn": None}],
        "blog_posts": [{"slug": "rag-guide", "title_en": "RAG Guide", "title_bn": "র‍্যাগ গাইড"}],
    }))


@pytest.mark.asyncio
async def test_links_verified_content_and_enabled_sections() -> None:
    result = await suggest_pages(
        Ctx(deps(db_pool=published_pool())),  # type: ignore[arg-type]
        sections=["pricing"],
        services=["ai-automation"],
        portfolio=["shop app"],
    )

    assert result == {"links": [
        {"kind": "service", "slug": "ai-automation", "title": "AI Automation"},
        {"kind": "portfolio", "slug": "shop-app", "title": "Shop App"},
        {"kind": "section", "section": "pricing"},
    ]}


@pytest.mark.asyncio
async def test_uses_bangla_titles_when_available() -> None:
    result = await suggest_pages(
        Ctx(deps(db_pool=published_pool(), locale="bn")),  # type: ignore[arg-type]
        services=["ai-automation"],
        portfolio=["shop-app"],
    )

    assert [link["title"] for link in result["links"]] == ["এআই অটোমেশন", "Shop App"]


@pytest.mark.asyncio
async def test_drops_unpublished_content_and_unknown_sections() -> None:
    result = await suggest_pages(
        Ctx(deps(db_pool=published_pool())),  # type: ignore[arg-type]
        sections=["admin", "portal", "../etc"],
        services=["secret-draft"],
    )

    assert result["error"] == "no_valid_links"


@pytest.mark.asyncio
async def test_disabled_section_is_neither_linked_nor_queried() -> None:
    pool = published_pool()
    result = await suggest_pages(
        Ctx(deps(  # type: ignore[arg-type]
            db_pool=pool,
            enabled_sections=["home", "services", "pricing"],
            enabled_content_types=["service"],
        )),
        sections=["blog"],
        blog=["rag-guide"],
    )

    assert result["error"] == "no_valid_links"
    assert pool.connection.calls == []


@pytest.mark.asyncio
async def test_section_links_need_the_web_section_list() -> None:
    result = await suggest_pages(
        Ctx(deps(enabled_sections=None, enabled_content_types=None)),  # type: ignore[arg-type]
        sections=["pricing"],
    )

    assert result["error"] == "no_valid_links"


@pytest.mark.asyncio
async def test_offline_fallback_links_static_services_only() -> None:
    result = await suggest_pages(
        Ctx(deps()),  # type: ignore[arg-type]
        services=["Website Development"],
        portfolio=["shop-app"],
    )

    assert result == {"links": [
        {"kind": "service", "slug": "website-development", "title": "Website Development"},
    ]}


@pytest.mark.asyncio
async def test_limits_and_deduplicates_links() -> None:
    result = await suggest_pages(
        Ctx(deps()),  # type: ignore[arg-type]
        sections=["pricing", "pricing", "contact", "schedule", "home", "services"],
        services=["ai-automation", "ai-automation"],
    )

    assert len(result["links"]) == MAX_LINKS
    keys = [(link["kind"], link.get("slug") or link.get("section")) for link in result["links"]]
    assert len(keys) == len(set(keys))


def test_knowledge_results_from_disabled_sections_are_dropped() -> None:
    results = [
        {"source_type": "blog", "content": "post"},
        {"source_type": "faq", "content": "faq"},
        {"source_type": "service", "content": "service"},
        {"source_type": "policy", "content": "policy"},
    ]

    kept = filter_disabled_sources(results, deps(enabled_content_types=["service"]))
    assert [r["source_type"] for r in kept] == ["faq", "service", "policy"]

    unrestricted = filter_disabled_sources(results, deps(enabled_content_types=None))
    assert len(unrestricted) == 4
