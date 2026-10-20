"""Human handoff tool for Reverse Cloud AI agent.

Enables the conversational agent to gracefully escalate ambiguous queries,
enterprise custom requirements, or explicit requests for human engineers.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic_ai import RunContext

from ..agents.deps import AgentDeps

logger = logging.getLogger(__name__)

INSERT_OUTBOX_SQL = """
INSERT INTO public.notifications_outbox (
    channel,
    recipient,
    subject,
    body,
    metadata
) VALUES (
    'email',
    'support@reversecloud.io',
    $1,
    $2,
    $3::jsonb
);
"""


async def request_human_handoff(
    ctx: RunContext[AgentDeps],
    reason: str,
    contact_info: str | None = None,
    preferred_channel: str | None = "email",
) -> dict[str, Any]:
    """Escalate the conversation to a human engineer or client manager at Reverse Cloud.

    Use this tool when:
    1. The visitor explicitly requests to speak with a human or team member.
    2. The project scope is highly custom, sensitive, or requires non-standard architecture.
    3. The AI cannot resolve the inquiry with available tools and knowledge.

    Args:
        ctx: Agent run context.
        reason: Summary of why human escalation is required.
        contact_info: Contact method provided by the visitor (email, phone, or Telegram).
        preferred_channel: Preferred contact mechanism ('email', 'telegram', 'phone').

    Returns:
        Structured handoff acknowledgement dict.
    """
    clean_reason = reason.strip()
    clean_contact = contact_info.strip() if contact_info else None

    if ctx:
        ctx.deps.handoff_requested = True
        ctx.deps.handoff_details = {
            "reason": clean_reason,
            "contact_info": clean_contact,
            "preferred_channel": preferred_channel,
        }

    pool = ctx.deps.db_pool if ctx else None
    if pool is not None and clean_contact:
        try:
            async with pool.acquire() as conn:
                import json

                metadata = json.dumps(
                    {
                        "source": "chat_handoff",
                        "conversation_id": ctx.deps.conversation_id if ctx else None,
                        "preferred_channel": preferred_channel,
                    }
                )
                await conn.execute(
                    INSERT_OUTBOX_SQL,
                    f"AI Chat Handoff Request: {clean_reason[:80]}",
                    f"Client contact: {clean_contact}\nReason: {clean_reason}",
                    metadata,
                )
        except Exception as exc:
            logger.warning("Could not queue notification outbox for handoff: %s", exc)

    return {
        "handoff": True,
        "reason": clean_reason,
        "contact_info": clean_contact,
        "message": (
            "Human escalation registered. A senior team member will review "
            "the conversation and follow up."
        ),
    }
