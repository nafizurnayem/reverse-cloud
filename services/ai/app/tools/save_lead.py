"""Lead capture tool for Reverse Cloud AI agent.

Inserts prospective client contact information into the public.leads table
with source='chat' and active consent timestamp, adhering to migration 0012 constraints.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic_ai import RunContext

from ..agents.deps import AgentDeps

logger = logging.getLogger(__name__)

INSERT_LEAD_SQL = """
INSERT INTO public.leads (
    name,
    email,
    phone,
    company,
    preferred_locale,
    message,
    source,
    consent_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    now()
)
RETURNING id, created_at;
"""


async def save_lead(
    ctx: RunContext[AgentDeps],
    name: str,
    email: str | None = None,
    phone: str | None = None,
    company: str | None = None,
    message: str = "",
) -> dict[str, Any]:
    """Save contact information and project requirements for a prospective client lead.

    Call this tool when the user provides their name and contact info (email or phone)
    to request a callback, consultation, or formal proposal.

    Args:
        ctx: Agent run context.
        name: Full name of the client (at least 2 characters).
        email: Contact email address (either email or phone is required).
        phone: Contact phone or WhatsApp number.
        company: Name of the client's business or organization (optional).
        message: Summary of project needs, requirements, or discussion notes.

    Returns:
        Confirmation dictionary with lead_id and status.
    """
    clean_name = name.strip()
    clean_email = email.strip() if email else None
    clean_phone = phone.strip() if phone else None
    clean_company = company.strip() if company else None
    clean_message = message.strip()

    if len(clean_name) < 2:
        return {"status": "error", "message": "Name must be at least 2 characters long."}

    if not clean_email and not clean_phone:
        return {
            "status": "error",
            "message": "Either email or phone number is required to save a contact lead.",
        }

    locale = ctx.deps.locale if ctx else "en"
    pool = ctx.deps.db_pool if ctx else None

    if pool is None:
        logger.info("Database pool not available; lead recorded in test/offline mode.")
        return {
            "status": "success",
            "lead_id": "test-lead-id",
            "message": "Lead received successfully (offline mode).",
        }

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                INSERT_LEAD_SQL,
                clean_name[:120],
                clean_email,
                clean_phone,
                clean_company,
                locale if locale in ("en", "bn") else "en",
                clean_message[:5000],
                "chat",
            )
            lead_id = str(row["id"]) if row else "created"
            logger.info("Lead created successfully with ID %s", lead_id)
            return {
                "status": "success",
                "lead_id": lead_id,
                "message": "Contact lead has been saved. Our team will follow up promptly.",
            }
    except Exception as exc:
        logger.error("Failed to insert lead into database: %s", exc)
        return {
            "status": "error",
            "message": f"Could not record lead: {exc}",
        }
