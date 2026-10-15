import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from ...chat import stream_chat_completion
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
from ...security.signing import InvalidSignature, verify_request_signature

router = APIRouter(prefix="/v1")


def _sse(event: str, payload: dict[str, str]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


async def _chat_events(payload: ChatRequest):
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
        stream = stream_chat_completion(payload)
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
    return StreamingResponse(
        _chat_events(payload),
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
