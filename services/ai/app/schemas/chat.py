from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
	role: Literal["user", "assistant"]
	content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
	messages: list[ChatMessage] = Field(min_length=1, max_length=50)
	locale: Literal["en", "bn"] = "en"
	conversation_id: str | None = Field(default=None, max_length=100)