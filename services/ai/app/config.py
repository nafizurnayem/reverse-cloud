from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	model_config = SettingsConfigDict(
		env_file=".env.local",
		env_file_encoding="utf-8",
		extra="ignore",
	)

	app_name: str = "Reverse Cloud AI service"
	app_version: str = "1.0.0"
	database_url: str | None = Field(
		default=None,
		validation_alias=AliasChoices("DATABASE_URL", "DATABASE_URL_AI"),
	)
	database_host: str = "localhost"
	database_port: int = Field(default=5432, ge=1, le=65535)
	database_name: str = "postgres"
	database_user: str = "postgres"
	database_password: str | None = None
	database_min_size: int = Field(default=1, ge=1)
	database_max_size: int = Field(default=5, ge=1)
	ai_hmac_secret_current: str | None = None
	ai_enabled: bool = True
	ai_daily_token_budget: int = Field(default=1_000_000, ge=1)
	ai_stream_timeout_seconds: float = Field(default=60.0, ge=1.0)
	llm_api_key: str | None = None
	llm_model: str = "gpt-4o-mini"
	ollama_url: str | None = None
	ollama_model: str = "llama3.2:1b"
	ollama_embedding_model: str = "qwen3-embedding:0.6b"
	gemini_api_key: str | None = Field(
		default=None,
		validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"),
	)
	gemini_model: str = "gemini-3.5-flash"
	gemini_embedding_model: str | None = None
	embedding_model: str | None = None
	embed_dim: int = Field(default=768, ge=1, le=4096)
	email_api_key: str | None = None
	email_api_url: str = "https://api.resend.com/emails"
	email_from: str | None = None
	site_url: str = Field(
		default="https://reversecloud.io",
		validation_alias=AliasChoices("SITE_URL", "NEXT_PUBLIC_SITE_URL"),
	)
	telegram_bot_token: str | None = None
	telegram_chat_id: str | None = None
	calcom_api_key: str | None = None
	outbox_batch_size: int = Field(default=20, ge=1, le=100)
	outbox_max_attempts: int = Field(default=5, ge=1, le=20)
	outbox_lock_timeout_seconds: int = Field(default=900, ge=60, le=3600)


@lru_cache
def get_settings() -> Settings:
	return Settings()


def resolved_gemini_api_key(settings: Settings) -> str | None:
	explicit_key = getattr(settings, "gemini_api_key", None)
	llm_api_key = getattr(settings, "llm_api_key", None)
	llm_model = getattr(settings, "llm_model", "")
	if explicit_key:
		return explicit_key
	if llm_api_key and llm_model.startswith("gemini-"):
		return llm_api_key
	return None


def resolved_gemini_model(settings: Settings) -> str:
	llm_api_key = getattr(settings, "llm_api_key", None)
	llm_model = getattr(settings, "llm_model", "")
	if llm_api_key and llm_model.startswith("gemini-"):
		return llm_model
	return getattr(settings, "gemini_model", "gemini-3.5-flash")


def resolved_gemini_embedding_model(settings: Settings) -> str:
	explicit_model = getattr(settings, "gemini_embedding_model", None)
	generic_model = getattr(settings, "embedding_model", None)
	if explicit_model:
		return explicit_model
	if generic_model and generic_model.startswith("gemini-"):
		return generic_model
	return "gemini-embedding-2"
