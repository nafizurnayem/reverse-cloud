"""Compatibility facade for the restructured sales agent runtime."""

from ..domain.conversation import has_explicit_save_confirmation
from ..domain.events import CardEvent, TextChunk, UsageEvent
from .model_factory import resolve_model
from .sales_agent import (
    convert_chat_messages,
    create_chat_agent,
    load_system_prompt,
    run_agent_stream,
)

__all__ = [
    "CardEvent",
    "TextChunk",
    "UsageEvent",
    "convert_chat_messages",
    "create_chat_agent",
    "has_explicit_save_confirmation",
    "load_system_prompt",
    "resolve_model",
    "run_agent_stream",
]
