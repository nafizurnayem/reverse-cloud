"""Chat persistence backed by Supabase Postgres."""

from uuid import UUID

import asyncpg

from ...security.guardrails import redact_pii


class PostgresConversationRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def daily_token_usage(self) -> int:
        async with self._pool.acquire() as connection:
            value = await connection.fetchval(
                """
                SELECT coalesce(sum(coalesce(tokens_in, 0) + coalesce(tokens_out, 0)), 0)
                FROM public.chat_messages
                WHERE created_at >= date_trunc('day', now());
                """
            )
        return int(value or 0)

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
    ) -> None:
        client_uuid = UUID(client_id) if client_id else None
        async with self._pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    """
                    INSERT INTO public.chat_sessions (id, client_id, locale, status)
                    VALUES ($1, $2, $3, 'active')
                    ON CONFLICT (id) DO UPDATE SET
                      client_id = coalesce(public.chat_sessions.client_id, excluded.client_id),
                      locale = excluded.locale,
                      last_active_at = now();
                    """,
                    session_id,
                    client_uuid,
                    locale,
                )
                await connection.execute(
                    """
                    INSERT INTO public.chat_messages
                      (session_id, role, content, tool_name, model, tokens_in, tokens_out, request_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                    """,
                    session_id,
                    role,
                    redact_pii(content),
                    tool_name,
                    model,
                    tokens_in,
                    tokens_out,
                    request_id,
                )
