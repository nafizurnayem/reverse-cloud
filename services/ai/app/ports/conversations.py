"""Conversation persistence boundary."""

from typing import Protocol
from uuid import UUID


class ConversationRepository(Protocol):
    async def daily_token_usage(self) -> int: ...

    async def append_message(
        self,
        *,
        session_id: UUID,
        locale: str,
        role: str,
        content: str,
        request_id: str,
        client_id: str | None = None,
        model: str | None = None,
        tokens_in: int | None = None,
        tokens_out: int | None = None,
        tool_name: str | None = None,
    ) -> None: ...
