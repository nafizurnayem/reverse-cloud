from pydantic import BaseModel, ConfigDict, Field


class EstimateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_type: str = Field(min_length=1, max_length=40)
    complexity: str = Field(default="standard", min_length=1, max_length=20)
    pages: int = Field(default=1, ge=1, le=100)
    integrations: int = Field(default=0, ge=0, le=20)
    features: list[str] = Field(default_factory=list, max_length=30)
    timeline_weeks: int | None = Field(default=None, ge=1, le=52)


class EstimateResponse(BaseModel):
    currency: str
    min_usd: int
    max_usd: int
    min_hours: int
    max_hours: int
    timeline_weeks: int
    assumptions: list[str]
