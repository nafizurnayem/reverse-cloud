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
