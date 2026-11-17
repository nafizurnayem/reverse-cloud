from typing import Literal

from pydantic import BaseModel, Field

ContentType = Literal["service", "portfolio", "blog"]
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class ChatMessage(BaseModel):
	role: Literal["user", "assistant"]
	content: str = Field(min_length=1, max_length=12000)


class PageContext(BaseModel):
	"""Page the visitor is viewing, resolved and verified by the web server."""

	section: str = Field(min_length=1, max_length=40, pattern=r"^[a-z_]+$")
	path: str = Field(min_length=1, max_length=200, pattern=r"^/[a-z0-9\-/]*$")
	slug: str | None = Field(default=None, max_length=120, pattern=SLUG_PATTERN)
	content_type: ContentType | None = None
	title: str | None = Field(default=None, max_length=200)


class ChatRequest(BaseModel):
	messages: list[ChatMessage] = Field(min_length=1, max_length=50)
	locale: Literal["en", "bn"] = "en"
	conversation_id: str | None = Field(default=None, max_length=100)
	client_id: str | None = Field(default=None, max_length=100)
	page_context: PageContext | None = None
	# Site structure from the web app's shared section list. None means the
	# caller did not send it (older web build); tools then allow every section.
	enabled_sections: list[str] | None = Field(default=None, max_length=30)
	enabled_content_types: list[ContentType] | None = Field(default=None, max_length=3)
