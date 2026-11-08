import json
import logging
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from ...agents.chat_agent import CardEvent, TextChunk, UsageEvent, run_agent_stream
from ...config import get_settings, resolved_gemini_api_key
from ...estimator.engine import EstimateInput, estimate_project
from ...schemas.chat import ChatRequest
from ...schemas.estimate import EstimateRequest, EstimateResponse
from ...security.guardrails import (
    GuardrailViolation,
    StreamTimeoutError,
    cap_message_history,
    check_token_budget,
    detect_prompt_injection,
    estimate_token_count,
    GuardrailState,
    redact_pii,
    stream_with_timeout,
)
from ...jobs.cost_report import generate_cost_report
from ...security.signing import InvalidSignature, verify_request_signature

router = APIRouter(prefix="/v1")
logger = logging.getLogger(__name__)


def _sse(event: str, payload: dict[str, str]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


async def _daily_tokens(db_pool) -> int:
    async with db_pool.acquire() as conn:
        value = await conn.fetchval(
            """
            SELECT coalesce(sum(coalesce(tokens_in, 0) + coalesce(tokens_out, 0)), 0)
            FROM public.chat_messages
            WHERE created_at >= date_trunc('day', now());
            """
        )
    return int(value or 0)


async def _persist_message(
    db_pool,
    *,
    session_id: UUID,
    locale: str,
    role: str,
    content: str,
    request_id: str,
    client_id: str | None = None,
    model: str | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    tool_name: str | None = None,
) -> None:
    client_uuid = UUID(client_id) if client_id else None
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO public.chat_sessions (id, client_id, locale, status)
            VALUES ($1, $2, $3, 'active')
            ON CONFLICT (id) DO UPDATE SET
              client_id = coalesce(public.chat_sessions.client_id, excluded.client_id),
              locale = excluded.locale,
              last_active_at = now();
            """,
            session_id,
            client_uuid,
            locale,
        )
        await conn.execute(
            """
            INSERT INTO public.chat_messages
              (session_id, role, content, tool_name, model, tokens_in, tokens_out, request_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            """,
            session_id,
            role,
            redact_pii(content),
            tool_name,
            model,
            tokens_in,
            tokens_out,
            request_id,
        )


async def _chat_events(payload: ChatRequest, db_pool=None, request_id: str | None = None):
    request_id = request_id or str(uuid4())
    try:
        session_id = UUID(payload.conversation_id) if payload.conversation_id else uuid4()
    except ValueError:
        yield _sse("error", {"code": "invalid_session", "message": "Invalid conversation session."})
        return
    payload.conversation_id = str(session_id)
    yield _sse("message_start", {"conversation_id": payload.conversation_id})
    settings = get_settings()
    model_name = (
        getattr(settings, "ollama_model", "ollama")
        if getattr(settings, "ollama_url", None)
        else getattr(settings, "llm_model", "unknown")
    )

    # 1. Kill switch check
    if not getattr(settings, "ai_enabled", True):
        yield _sse(
            "error",
            {
                "code": "service_disabled",
                "message": "AI chat is temporarily disabled. Please reach us through the contact form.",
            },
        )
        return

    # 2. History capping (max 20 messages)
    payload.messages = cap_message_history(payload.messages)

    # 3. Prompt injection detection
    latest_user_message = next(
        (m.content for m in reversed(payload.messages) if m.role == "user"), ""
    )
    if detect_prompt_injection(latest_user_message):
        yield _sse(
            "error",
            {
                "code": "guardrail_blocked",
                "message": "Your message cannot be processed by the AI system.",
            },
        )
        return

    token_limit: int | None = None
    if db_pool is not None:
        try:
            used = await _daily_tokens(db_pool)
            requested = sum(estimate_token_count(message.content) for message in payload.messages)
            check_token_budget(
                GuardrailState(
                    ai_enabled=True,
                    daily_token_budget=settings.ai_daily_token_budget,
                    daily_tokens_used=used,
                ),
                requested_tokens=requested,
            )
            token_limit = settings.ai_daily_token_budget - used
            await _persist_message(
                db_pool,
                session_id=session_id,
                locale=payload.locale,
                role="user",
                content=latest_user_message,
                request_id=request_id,
                client_id=payload.client_id,
            )
        except GuardrailViolation as error:
            yield _sse("error", {"code": error.code, "message": error.message, "request_id": request_id})
            return
        except Exception:
            logger.error("Chat budget/persistence failed [request_id=%s]", request_id, exc_info=True)
            yield _sse("error", {"code": "service_unavailable", "message": "AI chat is temporarily unavailable.", "request_id": request_id})
            return

    # FX-08: stream yields TextChunk (text delta) and CardEvent (renderable tool result).
    # FX-25: raw exception text is never forwarded to the client; a request_id is
    #        included so the error can be correlated with server logs.
    assistant_text: list[str] = []
    cards: list[CardEvent] = []
    usage = UsageEvent(input_tokens=0, output_tokens=0, tool_names=[])
    started_at = time.monotonic()
    try:
        stream = run_agent_stream(
            payload,
            pool=db_pool,
            client_id=payload.client_id,
            token_limit=token_limit,
        )
        timeout_seconds = getattr(settings, "ai_stream_timeout_seconds", 60.0)
        async for event in stream_with_timeout(stream, timeout_seconds=timeout_seconds):
            if isinstance(event, TextChunk):
                assistant_text.append(event.text)
            elif isinstance(event, CardEvent):
                cards.append(event)
            elif isinstance(event, UsageEvent):
                usage = event
    except StreamTimeoutError:
        yield _sse("error", {"code": "timeout", "message": "Response generation timed out.", "request_id": request_id})
    except GuardrailViolation as error:
        yield _sse("error", {"code": error.code, "message": error.message, "request_id": request_id})
    except Exception as error:
        # FX-25: log the full exception server-side; send only a safe generic message
        import logging as _logging
        _logging.getLogger(__name__).error(
            "Unhandled chat stream error [request_id=%s]: %s", request_id, error, exc_info=True
        )
        yield _sse("error", {"code": "server_error", "message": "Something went wrong. Please try again.", "request_id": request_id})
    else:
        safe_text = redact_pii("".join(assistant_text))
        if safe_text:
            yield _sse("text_delta", {"text": safe_text})
        for card in cards:
            yield _sse("card", {"type": card.card_type, "data": card.data})
        if db_pool is not None:
            try:
                await _persist_message(
                    db_pool,
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
                    await _persist_message(
                        db_pool,
                        session_id=session_id,
                        locale=payload.locale,
                        role="tool",
                        content="Tool completed.",
                        request_id=request_id,
                        tool_name=tool_name,
                    )
            except Exception:
                logger.error("Chat result persistence failed [request_id=%s]", request_id, exc_info=True)
        logger.info(
            "AI chat complete request_id=%s model=%s tokens_in=%s tokens_out=%s tools=%s duration_ms=%s",
            request_id,
            model_name,
            usage.input_tokens,
            usage.output_tokens,
            ",".join(usage.tool_names),
            round((time.monotonic() - started_at) * 1000),
        )
        yield _sse("message_end", {"reason": "stop"})


@router.post("/chat")
async def create_chat(
    payload: ChatRequest,
    request: Request,
    x_ai_timestamp: str | None = Header(default=None),
    x_ai_signature: str | None = Header(default=None),
) -> StreamingResponse:
    secret = get_settings().ai_hmac_secret_current
    if not secret or not x_ai_timestamp or not x_ai_signature:
        raise HTTPException(status_code=401, detail="missing service authentication")
    try:
        verify_request_signature(
            await request.body(), x_ai_timestamp, x_ai_signature, secret
        )
    except InvalidSignature as error:
        raise HTTPException(status_code=401, detail=str(error)) from error

    settings = get_settings()
    if (
        not settings.llm_api_key
        and not getattr(settings, "ollama_url", None)
        and not resolved_gemini_api_key(settings)
    ):
        raise HTTPException(status_code=503, detail="chat service is not configured")
    db_pool = getattr(request.app.state, "db_pool", None)
    return StreamingResponse(
        _chat_events(payload, db_pool=db_pool, request_id=request.state.request_id),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )


@router.post("/estimate", response_model=EstimateResponse)
async def create_estimate(
    payload: EstimateRequest,
    request: Request,
    x_ai_timestamp: str | None = Header(default=None),
    x_ai_signature: str | None = Header(default=None),
) -> EstimateResponse:
    secret = get_settings().ai_hmac_secret_current
    if not secret or not x_ai_timestamp or not x_ai_signature:
        raise HTTPException(status_code=401, detail="missing service authentication")
    try:
        verify_request_signature(
            await request.body(), x_ai_timestamp, x_ai_signature, secret
        )
    except InvalidSignature as error:
        raise HTTPException(status_code=401, detail=str(error)) from error

    try:
        estimate = estimate_project(
            EstimateInput(
                project_type=payload.project_type,
                complexity=payload.complexity,
                pages=payload.pages,
                integrations=payload.integrations,
                features=tuple(payload.features),
                timeline_weeks=payload.timeline_weeks,
            )
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return EstimateResponse(**estimate.as_dict())


@router.get("/cost-report")
async def cost_report(
    request: Request,
    x_ai_timestamp: str | None = Header(default=None),
    x_ai_signature: str | None = Header(default=None),
) -> dict:
    """Internal endpoint returning AI cost-vs-budget report (Phase 5, Wave 1)."""
    secret = get_settings().ai_hmac_secret_current
    if not secret or not x_ai_timestamp or not x_ai_signature:
        raise HTTPException(status_code=401, detail="missing service authentication")
    try:
        verify_request_signature(
            b"", x_ai_timestamp, x_ai_signature, secret
        )
    except InvalidSignature as error:
        raise HTTPException(status_code=401, detail=str(error)) from error

    db_pool = getattr(request.app.state, "db_pool", None)
    if db_pool is None:
        raise HTTPException(status_code=503, detail="database not available")

    async with db_pool.acquire() as conn:
        return await generate_cost_report(conn)
