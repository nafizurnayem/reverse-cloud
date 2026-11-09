"""Service catalog repository boundary."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ServiceCatalogItem:
    slug: str
    name: str
    pricing_model: str
    starting_from_usd: float | None
    summary: str

    def as_dict(self) -> dict[str, object]:
        return {
            "slug": self.slug,
            "name": self.name,
            "pricing_model": self.pricing_model,
            "starting_from_usd": self.starting_from_usd,
            "summary": self.summary,
        }


class CatalogRepository(Protocol):
    async def list_published_services(self, locale: str) -> list[ServiceCatalogItem]: ...
