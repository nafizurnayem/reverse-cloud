"""One-turn chatbot orchestration independent of HTTP and SSE."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator, Callable
from typing import Any
from uuid import UUID, uuid4

import asyncpg

from ..adapters.postgres.conversations import PostgresConversationRepository
from ..agents.sales_agent import run_agent_stream
from ..config import get_settings
from ..domain.events import AgentEvent, CardEvent, ChatEvent, TextChunk, UsageEvent
from ..domain.response_policy import direct_reply, ensure_useful_reply
from ..observability.chat_tracing import log_chat_completion
from ..ports.conversations import ConversationRepository
from ..schemas.chat import ChatRequest
from ..security.guardrails import (
    GuardrailState,
    GuardrailViolation,
    StreamTimeoutError,
    cap_message_history,
    check_token_budget,
    detect_prompt_injection,
    estimate_token_count,
    redact_pii,
    stream_with_timeout,
)

logger = logging.getLogger(__name__)
AgentRunner = Callable[..., AsyncIterator[AgentEvent]]


class ChatService:
    def __init__(
        self,
        *,
        pool: asyncpg.Pool | None = None,
        repository: ConversationRepository | None = None,
        agent_runner: AgentRunner = run_agent_stream,
        settings: Any = None,
    ) -> None:
        self._pool = pool
        self._repository = repository or (PostgresConversationRepository(pool) if pool is not None else None)
        self._agent_runner = agent_runner
        self._settings = settings or get_settings()

    async def run_turn(self, payload: ChatRequest, request_id: str | None = None) -> AsyncIterator[ChatEvent]:
        request_id = request_id or str(uuid4())
        try:
            session_id = UUID(payload.conversation_id) if payload.conversation_id else uuid4()
        except ValueError:
            yield ChatEvent("error", {"code": "invalid_session", "message": "Invalid conversation session."})
            return
        payload.conversation_id = str(session_id)
        yield ChatEvent("message_start", {"conversation_id": payload.conversation_id})

        if not getattr(self._settings, "ai_enabled", True):
            yield ChatEvent("error", {
                "code": "service_disabled",
                "message": "AI chat is temporarily disabled. Please reach us through the contact form.",
            })
            return

        payload.messages = cap_message_history(payload.messages)
        latest_user_message = next((message.content for message in reversed(payload.messages) if message.role == "user"), "")
        if detect_prompt_injection(latest_user_message):
            yield ChatEvent("error", {
                "code": "guardrail_blocked",
                "message": "Your message cannot be processed by the AI system.",
            })
            return

        immediate_reply = direct_reply(latest_user_message, payload.locale)
        if immediate_reply is not None:
            if self._repository is not None:
                try:
                    await self._repository.append_message(
                        session_id=session_id,
                        locale=payload.locale,
                        role="user",
                        content=latest_user_message,
                        request_id=request_id,
                        client_id=payload.client_id,
                    )
                    await self._repository.append_message(
                        session_id=session_id,
                        locale=payload.locale,
                        role="assistant",
                        content=immediate_reply,
                        request_id=request_id,
                        model="deterministic-response-policy",
                        tokens_in=0,
                        tokens_out=0,
                    )
                except Exception:
                    logger.warning("Direct chat reply persistence failed [request_id=%s]", request_id, exc_info=True)
            yield ChatEvent("text_delta", {"text": immediate_reply})
            yield ChatEvent("message_end", {"reason": "stop"})
            return

        token_limit: int | None = None
        if self._repository is not None:
            try:
                used = await self._repository.daily_token_usage()
                requested = sum(estimate_token_count(message.content) for message in payload.messages)
                check_token_budget(
                    GuardrailState(
                        ai_enabled=True,
                        daily_token_budget=self._settings.ai_daily_token_budget,
                        daily_tokens_used=used,
                    ),
                    requested_tokens=requested,
                )
                token_limit = self._settings.ai_daily_token_budget - used
                await self._repository.append_message(
                    session_id=session_id,
                    locale=payload.locale,
                    role="user",
                    content=latest_user_message,
                    request_id=request_id,
                    client_id=payload.client_id,
                )
            except GuardrailViolation as error:
                yield ChatEvent("error", {"code": error.code, "message": error.message, "request_id": request_id})
                return
            except Exception:
                logger.error("Chat budget/persistence failed [request_id=%s]", request_id, exc_info=True)
                yield ChatEvent("error", {
                    "code": "service_unavailable",
                    "message": "AI chat is temporarily unavailable.",
                    "request_id": request_id,
                })
                return

        assistant_text: list[str] = []
        cards: list[CardEvent] = []
        usage = UsageEvent(input_tokens=0, output_tokens=0, tool_names=[])
        started_at = time.monotonic()
        try:
            stream = self._agent_runner(
                payload,
                pool=self._pool,
                client_id=payload.client_id,
                token_limit=token_limit,
            )
            timeout_seconds = getattr(self._settings, "ai_stream_timeout_seconds", 60.0)
            async for event in stream_with_timeout(stream, timeout_seconds=timeout_seconds):
                if isinstance(event, TextChunk):
                    assistant_text.append(event.text)
                elif isinstance(event, CardEvent):
                    cards.append(event)
                elif isinstance(event, UsageEvent):
                    usage = event
        except StreamTimeoutError:
            yield ChatEvent("error", {"code": "timeout", "message": "Response generation timed out.", "request_id": request_id})
            return
        except GuardrailViolation as error:
            yield ChatEvent("error", {"code": error.code, "message": error.message, "request_id": request_id})
            return
        except Exception:
            logger.error("Unhandled chat stream error [request_id=%s]", request_id, exc_info=True)
            yield ChatEvent("error", {
                "code": "server_error",
                "message": "Something went wrong. Please try again.",
                "request_id": request_id,
            })
            return

        raw_text = redact_pii("".join(assistant_text))
        safe_text = ensure_useful_reply(raw_text, payload.locale) if raw_text or not cards else ""
        if safe_text:
            yield ChatEvent("text_delta", {"text": safe_text})
        for card in cards:
            yield ChatEvent("card", {"type": card.card_type, "data": card.data})

        model_name = (
            getattr(self._settings, "ollama_model", "ollama")
            if getattr(self._settings, "ollama_url", None)
            else getattr(self._settings, "llm_model", "unknown")
        )
        if self._repository is not None:
            try:
                await self._repository.append_message(
                    session_id=session_id,
                    locale=payload.locale,
                    role="assistant",
                    content=safe_text,
                    request_id=request_id,
                    model=model_name,
                    tokens_in=usage.input_tokens,
                    tokens_out=usage.output_tokens,
                )
                for tool_name in usage.tool_names:
                    await self._repository.append_message(
                        session_id=session_id,
                        locale=payload.locale,
                        role="tool",
                        content="Tool completed.",
                        request_id=request_id,
                        tool_name=tool_name,
                    )
            except Exception:
                logger.error("Chat result persistence failed [request_id=%s]", request_id, exc_info=True)

        log_chat_completion(
            request_id=request_id,
            model=model_name,
            tokens_in=usage.input_tokens,
            tokens_out=usage.output_tokens,
            tools=usage.tool_names,
            duration_ms=round((time.monotonic() - started_at) * 1000),
        )
        yield ChatEvent("message_end", {"reason": "stop"})
