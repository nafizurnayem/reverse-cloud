"""PydanticAI conversational agent for Reverse Cloud.

Coordinates multi-step tool execution, RAG knowledge retrieval, project estimation,
lead capture, scheduling, and bilingual responses in English and Bengali.
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Any

import asyncpg
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, ToolReturnPart, UserPromptPart
from pydantic_ai.models.ollama import OllamaModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from ..config import get_settings
from ..retrieval.ingest import Embedder
from ..schemas.chat import ChatMessage, ChatRequest
from ..tools.estimate_tool import get_estimate
from ..tools.human_handoff import request_human_handoff
from ..tools.knowledge_search import search_knowledge
from ..tools.project_status import get_project_status
from ..tools.save_lead import save_lead
from ..tools.scheduling import create_booking_hold, get_available_slots
from ..tools.services_list import list_services
from .deps import AgentDeps

logger = logging.getLogger(__name__)


# FX-08: structured event types yielded by run_agent_stream so that routes.py
# can emit both SSE "text_delta" and SSE "card" events from a single stream.
@dataclass
class TextChunk:
    """A streamed text delta from the LLM."""
    text: str


@dataclass
class CardEvent:
    """A tool result that the UI should render as a card."""
    card_type: str
    data: dict


# Maps pydantic_ai tool function names to the card type the frontend expects.
_TOOL_CARD_TYPES: dict[str, str] = {
    "create_booking_hold": "booking_proposal",
    "get_estimate": "estimate",
    "save_lead": "lead_saved",
    "request_human_handoff": "handoff",
    "get_project_status": "project_status",
}

# Suppress banner in production environments
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

PROMPTS_DIR = Path(__file__).parent / "prompts"


@lru_cache(maxsize=4)
def load_system_prompt(locale: str = "en") -> str:
    """Load and cache system prompt from text files for the specified locale."""
    target_file = PROMPTS_DIR / f"system_{locale}.txt"
    if not target_file.is_file():
        target_file = PROMPTS_DIR / "system_en.txt"

    if target_file.is_file():
        return target_file.read_text(encoding="utf-8")

    return (
        "You are the senior technical sales engineer and client consultation AI for Reverse Cloud. "
        "Help clients identify optimal technical solutions and estimate budgets accurately."
    )


def resolve_model(override_model: Any = None) -> Any:
    """Resolve the LLM model instance for the agent."""
    if override_model is not None:
        return override_model

    settings = get_settings()
    if settings.ollama_url:
        provider = OllamaProvider(base_url=f"{settings.ollama_url.rstrip('/')}/v1")
        return OllamaModel(settings.ollama_model, provider=provider)

    if not settings.llm_api_key:
        logger.warning("No Ollama URL or LLM_API_KEY configured; falling back to TestModel")
        return TestModel()

    provider = OpenAIProvider(api_key=settings.llm_api_key)
    return OpenAIChatModel(settings.llm_model, provider=provider)


def create_chat_agent(model: Any = None) -> Agent[AgentDeps, str]:
    """Instantiate and configure the Reverse Cloud conversational agent with all tools."""
    resolved_model = resolve_model(model)
    agent = Agent(
        model=resolved_model,
        deps_type=AgentDeps,
        output_type=str,
        retries=2,
    )

    @agent.system_prompt
    def dynamic_system_prompt(ctx: RunContext[AgentDeps]) -> str:
        locale = ctx.deps.locale if ctx else "en"
        return load_system_prompt(locale)

    # Register all Phase 2, 4, 5 tools
    agent.tool(search_knowledge)
    agent.tool(list_services)
    agent.tool_plain(get_estimate)
    agent.tool(save_lead)
    agent.tool(request_human_handoff)
    agent.tool(get_available_slots)
    agent.tool(create_booking_hold)
    agent.tool(get_project_status)

    return agent


def convert_chat_messages(
    messages: list[ChatMessage],
) -> tuple[str, list[ModelMessage]]:
    """Convert a list of ChatMessages into the latest user prompt and preceding history."""
    if not messages:
        return "", []

    # Find the last message from user
    last_user_idx = -1
    for idx in range(len(messages) - 1, -1, -1):
        if messages[idx].role == "user":
            last_user_idx = idx
            break

    if last_user_idx == -1:
        # No user message found; take last message content
        return messages[-1].content, []

    latest_prompt = messages[last_user_idx].content

    # Build preceding history
    history: list[ModelMessage] = []
    for msg in messages[:last_user_idx]:
        if msg.role == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))
        elif msg.role == "assistant":
            history.append(ModelResponse(parts=[TextPart(content=msg.content)]))

    return latest_prompt, history


async def run_agent_stream(
    payload: ChatRequest,
    pool: asyncpg.Pool | None = None,
    embedder: Embedder | None = None,
    model: Any = None,
    client_id: str | None = None,
) -> AsyncIterator[TextChunk | CardEvent]:
    """Execute the agent in streaming mode, yielding text chunks and card events.

    FX-08: After all text deltas have been streamed, the completed tool results are
    inspected and CardEvent objects are yielded for any tool whose output maps to a
    UI card (booking proposal, estimate, saved lead, handoff, project status).

    Args:
        payload: ChatRequest with message list, locale, and conversation_id.
        pool: asyncpg pool for tool queries (leads, knowledge chunks, scheduling, project status).
        embedder: Custom embedder protocol instance (defaults to the configured provider).
        model: Optional model override for unit and integration testing.
        client_id: Optional authenticated client UUID for project status queries.

    Yields:
        TextChunk for incremental text deltas, CardEvent for renderable tool results.
    """
    agent = create_chat_agent(model=model)
    deps = AgentDeps(
        db_pool=pool,
        locale=payload.locale,
        conversation_id=payload.conversation_id,
        embedder=embedder,
        client_id=client_id or payload.client_id,
    )

    user_prompt, history = convert_chat_messages(payload.messages)
    if not user_prompt:
        return

    async with agent.run_stream(
        user_prompt=user_prompt,
        message_history=history,
        deps=deps,
    ) as result_stream:
        # Stream text deltas first
        async for chunk in result_stream.stream_text(delta=True):
            if chunk:
                yield TextChunk(text=chunk)

        # FX-08: after the text stream ends, inspect all new messages for tool
        # return parts and emit a CardEvent for each one the UI can render.
        try:
            for msg in result_stream.new_messages():
                if not isinstance(msg, ModelRequest):
                    continue
                for part in msg.parts:
                    if not isinstance(part, ToolReturnPart):
                        continue
                    card_type = _TOOL_CARD_TYPES.get(part.tool_name)
                    if card_type is None:
                        continue
                    try:
                        import json as _json
                        data = part.content if isinstance(part.content, dict) else _json.loads(part.content)
                    except Exception:
                        data = {"raw": str(part.content)}
                    # Only emit a card when the tool call actually succeeded
                    if isinstance(data, dict) and data.get("error"):
                        continue
                    yield CardEvent(card_type=card_type, data=data)
        except Exception as exc:
            logger.warning("Card event extraction failed: %s", exc)
