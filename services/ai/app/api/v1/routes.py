from fastapi import APIRouter, Header, HTTPException, Request

from ...config import get_settings
from ...estimator.engine import EstimateInput, estimate_project
from ...schemas.estimate import EstimateRequest, EstimateResponse
from ...security.signing import InvalidSignature, verify_request_signature

router = APIRouter(prefix="/v1")


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
