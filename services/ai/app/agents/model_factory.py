"""LLM provider selection for the sales agent."""

from __future__ import annotations

import logging
from typing import Any

from pydantic_ai.exceptions import ModelAPIError, UnexpectedModelBehavior
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.ollama import OllamaModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.ollama import OllamaProvider
from pydantic_ai.providers.openai import OpenAIProvider

from ..config import get_settings, resolved_gemini_api_key, resolved_gemini_model

logger = logging.getLogger(__name__)


def resolve_model(override_model: Any = None) -> Any:
    """Resolve the configured local/cloud model and fallback order."""
    if override_model is not None:
        return override_model
    settings = get_settings()
    gemini_api_key = resolved_gemini_api_key(settings)
    gemini_model = None
    if gemini_api_key:
        gemini_model = GoogleModel(
            resolved_gemini_model(settings),
            provider=GoogleProvider(api_key=gemini_api_key),
        )
    if settings.ollama_url:
        ollama_model = OllamaModel(
            settings.ollama_model,
            provider=OllamaProvider(base_url=f"{settings.ollama_url.rstrip('/')}/v1"),
        )
        return (
            FallbackModel(ollama_model, gemini_model, fallback_on=(ModelAPIError, UnexpectedModelBehavior))
            if gemini_model
            else ollama_model
        )
    if gemini_model:
        return gemini_model
    if not settings.llm_api_key:
        logger.warning("No Ollama URL or cloud LLM configured; falling back to TestModel")
        return TestModel()
    return OpenAIChatModel(
        settings.llm_model,
        provider=OpenAIProvider(api_key=settings.llm_api_key),
    )
