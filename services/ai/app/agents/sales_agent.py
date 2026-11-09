"""Reverse Cloud sales and client-support agent runtime."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Any

import asyncpg
from pydantic_ai import Agent, UsageLimits
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, ToolReturnPart, UserPromptPart

from ..domain.conversation import has_explicit_save_confirmation
from ..domain.events import AgentEvent, CardEvent, TextChunk, UsageEvent
from ..retrieval.ingest import Embedder
from ..schemas.chat import ChatMessage, ChatRequest
from ..security.guardrails import MAX_TOOL_CALLS_PER_TURN
from .deps import AgentDeps
from .model_factory import resolve_model
from .tool_registry import TOOL_CARD_TYPES, register_tools

logger = logging.getLogger(__name__)
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")
PROMPTS_DIR = Path(__file__).parent / "prompts"


@lru_cache(maxsize=4)
def load_system_prompt(locale: str = "en") -> str:
    target = PROMPTS_DIR / f"system_{locale}.txt"
    if not target.is_file():
        target = PROMPTS_DIR / "system_en.txt"
    if target.is_file():
        return target.read_text(encoding="utf-8")
    return "You are the senior technical sales engineer for Reverse Cloud."


def create_chat_agent(model: Any = None, locale: str = "en") -> Agent[AgentDeps, str]:
    agent = Agent(
        model=resolve_model(model),
        deps_type=AgentDeps,
        output_type=str,
        system_prompt=load_system_prompt(locale),
        retries=2,
    )
    register_tools(agent)
    return agent


def convert_chat_messages(messages: list[ChatMessage]) -> tuple[str, list[ModelMessage]]:
    if not messages:
        return "", []
    last_user_index = next(
        (index for index in range(len(messages) - 1, -1, -1) if messages[index].role == "user"),
        -1,
    )
    if last_user_index == -1:
        return messages[-1].content, []
    history: list[ModelMessage] = []
    for message in messages[:last_user_index]:
        if message.role == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=message.content)]))
        elif message.role == "assistant":
            history.append(ModelResponse(parts=[TextPart(content=message.content)]))
    return messages[last_user_index].content, history


async def run_agent_stream(
    payload: ChatRequest,
    pool: asyncpg.Pool | None = None,
    embedder: Embedder | None = None,
    model: Any = None,
    client_id: str | None = None,
    token_limit: int | None = None,
) -> AsyncIterator[AgentEvent]:
    """Run one agent turn and expose typed text, card, and usage events."""
    agent = create_chat_agent(model=model, locale=payload.locale)
    deps = AgentDeps(
        db_pool=pool,
        locale=payload.locale,
        conversation_id=payload.conversation_id,
        embedder=embedder,
        client_id=client_id or payload.client_id,
        sensitive_action_confirmed=has_explicit_save_confirmation(payload.messages),
    )
    user_prompt, history = convert_chat_messages(payload.messages)
    if not user_prompt:
        return
    limits: dict[str, int] = {"tool_calls_limit": MAX_TOOL_CALLS_PER_TURN}
    if token_limit is not None:
        limits["total_tokens_limit"] = max(1, token_limit)

    async with agent.run_stream(
        user_prompt=user_prompt,
        message_history=history,
        deps=deps,
        usage_limits=UsageLimits(**limits),
    ) as result_stream:
        async for chunk in result_stream.stream_text(delta=True):
            if chunk:
                yield TextChunk(text=chunk)

        tool_names: list[str] = []
        try:
            for message in result_stream.new_messages():
                if not isinstance(message, ModelRequest):
                    continue
                for part in message.parts:
                    if not isinstance(part, ToolReturnPart):
                        continue
                    tool_names.append(part.tool_name)
                    card_type = TOOL_CARD_TYPES.get(part.tool_name)
                    if card_type is None:
                        continue
                    try:
                        data = part.content if isinstance(part.content, dict) else json.loads(part.content)
                    except Exception:
                        data = {"raw": str(part.content)}
                    if not isinstance(data, dict):
                        continue
                    if data.get("error") or data.get("status") in {"error", "confirmation_required"}:
                        continue
                    yield CardEvent(card_type=card_type, data=data)
        except Exception:
            logger.warning("Card event extraction failed", exc_info=True)

        usage = result_stream.usage
        yield UsageEvent(
            input_tokens=int(getattr(usage, "input_tokens", getattr(usage, "request_tokens", 0)) or 0),
            output_tokens=int(getattr(usage, "output_tokens", getattr(usage, "response_tokens", 0)) or 0),
            tool_names=tool_names,
        )
