"""Typed events shared by the agent runtime and application layer."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, TypeAlias


@dataclass(frozen=True)
class TextChunk:
    text: str


@dataclass(frozen=True)
class CardEvent:
    card_type: str
    data: dict[str, Any]


@dataclass(frozen=True)
class UsageEvent:
    input_tokens: int
    output_tokens: int
    tool_names: list[str]


AgentEvent: TypeAlias = TextChunk | CardEvent | UsageEvent


@dataclass(frozen=True)
class ChatEvent:
    """Transport-neutral event emitted for one chat turn."""

    event: Literal["message_start", "text_delta", "card", "error", "message_end"]
    data: dict[str, Any]
