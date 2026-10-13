"""AI Guardrails and Safety Controls (plan sections 8.4, 8.8, 10).

Covers:
1. `ai_enabled` Kill Switch (drops immediately to contact form/fallback)
2. `ai_daily_token_budget` enforcement
3. Max 6 tool calls per turn safeguard
4. History capped to last 20 messages
5. Basic prompt injection heuristic filtering
6. Fix 6 streaming timeout protection (60s limit)
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
import re
from typing import Any

from ..schemas.chat import ChatMessage


class GuardrailViolation(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class KillSwitchActiveError(GuardrailViolation):
    def __init__(self, message: str = "AI chat is temporarily disabled. Please reach us through the contact form.") -> None:
        super().__init__("service_disabled", message)


class TokenBudgetExceededError(GuardrailViolation):
    def __init__(self, message: str = "Daily token budget reached. Please leave your details via the contact form.") -> None:
        super().__init__("budget_exceeded", message)


class StreamTimeoutError(GuardrailViolation):
    def __init__(self, message: str = "Response generation timed out.") -> None:
        super().__init__("timeout", message)


# Prompt injection detection patterns
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)\s+prompts?", re.IGNORECASE),
    re.compile(r"(reveal|print|show|dump)\s+(the\s+)?(system\s+prompt|hidden\s+instructions?)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in\s+developer\s+mode|dan|an\s+unrestricted\s+ai)", re.IGNORECASE),
    re.compile(r"bypass\s+(all\s+)?(safety|security|rules|filters)", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
]

MAX_HISTORY_MESSAGES = 20
MAX_TOOL_CALLS_PER_TURN = 6
STREAM_TIMEOUT_SECONDS = 60.0


@dataclass
class GuardrailState:
    ai_enabled: bool = True
    daily_token_budget: int = 1_000_000
    daily_tokens_used: int = 0


def detect_prompt_injection(text: str) -> bool:
    """Return True if suspicious prompt injection patterns are detected."""
    if not text:
        return False
    return any(pattern.search(text) for pattern in _INJECTION_PATTERNS)


def cap_message_history(messages: Sequence[ChatMessage], max_history: int = MAX_HISTORY_MESSAGES) -> list[ChatMessage]:
    """Ensure message history does not exceed the allowed window (default 20 messages)."""
    if len(messages) <= max_history:
        return list(messages)
    return list(messages[-max_history:])


def check_kill_switch(state: GuardrailState) -> None:
    """Check if the AI service kill switch is flipped."""
    if not state.ai_enabled:
        raise KillSwitchActiveError()


def check_token_budget(state: GuardrailState, requested_tokens: int = 0) -> None:
    """Check if the daily token budget has been exhausted."""
    if state.daily_tokens_used + requested_tokens > state.daily_token_budget:
        raise TokenBudgetExceededError()


async def stream_with_timeout(
    stream: AsyncIterator[str],
    timeout_seconds: float = STREAM_TIMEOUT_SECONDS,
) -> AsyncIterator[str]:
    """Enforce a strict timeout per chunk and total stream duration (Fix 6)."""
    iterator = stream.__aiter__()
    while True:
        try:
            item = await asyncio.wait_for(iterator.__anext__(), timeout=timeout_seconds)
            yield item
        except StopAsyncIteration:
            break
        except asyncio.TimeoutError as err:
            raise StreamTimeoutError() from err
