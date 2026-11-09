"""Versioned HTTP transport for AI use cases."""

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from ...agents.sales_agent import run_agent_stream
from ...api.sse import encode_sse
from ...application.chat_service import ChatService
from ...config import get_settings, resolved_gemini_api_key
from ...estimator.engine import EstimateInput, estimate_project
from ...jobs.cost_report import generate_cost_report
from ...schemas.chat import ChatRequest
from ...schemas.estimate import EstimateRequest, EstimateResponse
from ...security.signing import InvalidSignature, verify_request_signature

router = APIRouter(prefix="/v1")


def _verify_service_request(body: bytes, timestamp: str | None, signature: str | None) -> None:
    secret = get_settings().ai_hmac_secret_current
    if not secret or not timestamp or not signature:
        raise HTTPException(status_code=401, detail="missing service authentication")
    try:
        verify_request_signature(body, timestamp, signature, secret)
    except InvalidSignature as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


async def _chat_events(payload: ChatRequest, db_pool=None, request_id: str | None = None):
    """Compatibility generator that adapts typed application events to SSE."""
    service = ChatService(
        pool=db_pool,
        agent_runner=run_agent_stream,
        settings=get_settings(),
    )
    async for event in service.run_turn(payload, request_id=request_id):
        yield encode_sse(event)


@router.post("/chat")
async def create_chat(
    payload: ChatRequest,
    request: Request,
    x_ai_timestamp: str | None = Header(default=None),
    x_ai_signature: str | None = Header(default=None),
) -> StreamingResponse:
    _verify_service_request(await request.body(), x_ai_timestamp, x_ai_signature)
    settings = get_settings()
    if (
        not getattr(settings, "llm_api_key", None)
        and not getattr(settings, "ollama_url", None)
        and not resolved_gemini_api_key(settings)
    ):
        raise HTTPException(status_code=503, detail="chat service is not configured")
    return StreamingResponse(
        _chat_events(
            payload,
            db_pool=getattr(request.app.state, "db_pool", None),
            request_id=request.state.request_id,
        ),
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
    _verify_service_request(await request.body(), x_ai_timestamp, x_ai_signature)
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
    _verify_service_request(b"", x_ai_timestamp, x_ai_signature)
    db_pool = getattr(request.app.state, "db_pool", None)
    if db_pool is None:
        raise HTTPException(status_code=503, detail="database not available")
    async with db_pool.acquire() as connection:
        return await generate_cost_report(connection)
