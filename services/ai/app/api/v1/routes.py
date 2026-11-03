import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

import uuid as _uuid
from ...agents.chat_agent import CardEvent, TextChunk, run_agent_stream
from ...config import get_settings, resolved_gemini_api_key
from ...estimator.engine import EstimateInput, estimate_project
from ...schemas.chat import ChatRequest
from ...schemas.estimate import EstimateRequest, EstimateResponse
from ...security.guardrails import (
    GuardrailViolation,
    StreamTimeoutError,
    cap_message_history,
    detect_prompt_injection,
    stream_with_timeout,
)
from ...jobs.cost_report import generate_cost_report
from ...security.signing import InvalidSignature, verify_request_signature

router = APIRouter(prefix="/v1")


def _sse(event: str, payload: dict[str, str]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


async def _chat_events(payload: ChatRequest, db_pool=None):
    yield _sse("message_start", {"conversation_id": payload.conversation_id or ""})
    settings = get_settings()

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

    # FX-08: stream yields TextChunk (text delta) and CardEvent (renderable tool result).
    # FX-25: raw exception text is never forwarded to the client; a request_id is
    #        included so the error can be correlated with server logs.
    request_id = str(_uuid.uuid4())
    try:
        stream = run_agent_stream(payload, pool=db_pool, client_id=payload.client_id)
        timeout_seconds = getattr(settings, "ai_stream_timeout_seconds", 60.0)
        async for event in stream_with_timeout(stream, timeout_seconds=timeout_seconds):
            if isinstance(event, TextChunk):
                yield _sse("text_delta", {"text": event.text})
            elif isinstance(event, CardEvent):
                yield _sse("card", {"type": event.card_type, "data": event.data})
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
        _chat_events(payload, db_pool=db_pool),
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
