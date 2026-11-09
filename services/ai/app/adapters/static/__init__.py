"""Offline fallbacks used when Supabase has no published configuration."""

from .catalog import StaticCatalogRepository

__all__ = ["StaticCatalogRepository"]
