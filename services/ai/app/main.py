"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from uuid import uuid4

import asyncpg
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from .api.v1.routes import router as v1_router
from .config import get_settings


@asynccontextmanager
async def lifespan(application: FastAPI):
	settings = get_settings()
	application.state.db_pool = None
	if settings.database_url:
		application.state.db_pool = await asyncpg.create_pool(
			dsn=settings.database_url,
			min_size=settings.database_min_size,
			max_size=settings.database_max_size,
		)
	try:
		yield
	finally:
		if application.state.db_pool is not None:
			await application.state.db_pool.close()


app = FastAPI(
	title=get_settings().app_name,
	version=get_settings().app_version,
	lifespan=lifespan,
)
app.include_router(v1_router)


@app.middleware("http")
async def add_request_id(request: Request, call_next) -> Response:
	request_id = request.headers.get("x-request-id") or str(uuid4())
	request.state.request_id = request_id
	response = await call_next(request)
	response.headers["x-request-id"] = request_id
	return response


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.get("/ready")
async def ready(request: Request) -> Response:
	"""Verify the dependencies required by the production chat path."""
	settings = get_settings()
	checks: dict[str, str] = {}
	pool = request.app.state.db_pool
	if pool is None:
		checks["database"] = "missing"
	else:
		try:
			async with pool.acquire() as connection:
				await connection.fetchval("select 1")
			checks["database"] = "ok"
		except Exception:
			checks["database"] = "unavailable"

	if settings.ollama_url:
		try:
			async with httpx.AsyncClient(timeout=3.0) as client:
				response = await client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
				response.raise_for_status()
			checks["model"] = "ok"
		except Exception:
			checks["model"] = "unavailable"
	elif settings.llm_api_key or settings.gemini_api_key:
		checks["model"] = "configured"
	else:
		checks["model"] = "missing"

	status = 200 if all(value in {"ok", "configured"} for value in checks.values()) else 503
	return JSONResponse({"status": "ready" if status == 200 else "not_ready", "checks": checks}, status_code=status)
