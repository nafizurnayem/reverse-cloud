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


@lru_cache
def get_settings() -> Settings:
	return Settings()
