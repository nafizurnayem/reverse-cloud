import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from ...agents.chat_agent import run_agent_stream
from ...config import get_settings
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

    try:
        stream = run_agent_stream(payload, pool=db_pool, client_id=payload.client_id)
        timeout_seconds = getattr(settings, "ai_stream_timeout_seconds", 60.0)
        async for text in stream_with_timeout(stream, timeout_seconds=timeout_seconds):
            yield _sse("text_delta", {"text": text})
    except StreamTimeoutError:
        yield _sse("error", {"code": "timeout", "message": "Response generation timed out."})
    except GuardrailViolation as error:
        yield _sse("error", {"code": error.code, "message": error.message})
    except Exception as error:
        yield _sse("error", {"code": "provider_error", "message": str(error)})
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

    if not get_settings().llm_api_key:
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
