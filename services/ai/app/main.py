"""FastAPI application entry point."""

from fastapi import FastAPI

from .api.v1.routes import router as v1_router

app = FastAPI(title="Reverse Cloud AI service", version="1.0.0")
app.include_router(v1_router)


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}
