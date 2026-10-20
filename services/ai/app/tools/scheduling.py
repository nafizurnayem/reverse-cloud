"""Scheduling tools for Reverse Cloud AI agent.

Integrates with Cal.com API and creates booking proposal holds in public.booking_proposals
(migration 0018, Phase 4 Wave 3).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from pydantic_ai import RunContext

from ..agents.deps import AgentDeps
from ..config import get_settings

logger = logging.getLogger(__name__)

CALCOM_API_VERSION = "2024-09-04"

INSERT_PROPOSAL_SQL = """
INSERT INTO public.booking_proposals (
    session_id,
    meeting_type_id,
    starts_at,
    ends_at,
    timezone,
    intake_summary
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING id, session_id, meeting_type_id, starts_at, ends_at, timezone, expires_at, status;
"""

SELECT_MEETING_TYPE_SQL = """
SELECT id, key, duration_min, calcom_event_type_id
FROM public.meeting_types
WHERE key = $1 AND is_active = true
LIMIT 1;
"""


async def get_available_slots(
    ctx: RunContext[AgentDeps],
    meeting_type: str = "discovery_call",
    time_zone: str = "UTC",
    days_ahead: int = 5,
) -> list[dict[str, str]]:
    """Retrieve available consultation time slots from Cal.com.

    Args:
        ctx: Agent run context.
        meeting_type: Meeting type key ('discovery_call' or 'technical_consult').
        time_zone: Client IANA time zone (e.g. 'America/New_York', 'Asia/Dhaka', 'UTC').
        days_ahead: Number of days forward to search for openings (1-14).

    Returns:
        List of slot objects with 'start' and 'end' ISO-8601 strings.
    """
    settings = get_settings()
    api_key = (ctx.deps.calcom_api_key if ctx else None) or getattr(settings, "calcom_api_key", None)

    now = datetime.now(timezone.utc)
    start_dt = now + timedelta(days=1)
    end_dt = start_dt + timedelta(days=max(1, min(days_ahead, 14)))

    start_iso = start_dt.strftime("%Y-%m-%dT00:00:00Z")
    end_iso = end_dt.strftime("%Y-%m-%dT23:59:59Z")

    # If DB pool is available, look up event_type_id
    pool = ctx.deps.db_pool if ctx else None
    event_type_id: str | None = None
    duration_min = 30

    if pool is not None:
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(SELECT_MEETING_TYPE_SQL, meeting_type)
                if row:
                    event_type_id = row["calcom_event_type_id"]
                    duration_min = row["duration_min"]
        except Exception as exc:
            logger.debug("Meeting type DB lookup failed: %s", exc)

    if api_key and event_type_id:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    "https://api.cal.com/v2/slots",
                    params={
                        "eventTypeId": event_type_id,
                        "start": start_iso,
                        "end": end_iso,
                        "timeZone": time_zone,
                        "format": "range",
                    },
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "cal-api-version": CALCOM_API_VERSION,
                    },
                )
                if res.is_success:
                    payload = res.json()
                    raw_slots = payload.get("data", {}).get("slots", [])
                    formatted_slots = []
                    for item in raw_slots[:8]:
                        s = item.get("start")
                        e = item.get("end")
                        if s and e:
                            formatted_slots.append({"start": s, "end": e})
                    if formatted_slots:
                        return formatted_slots
        except Exception as exc:
            logger.warning("Cal.com API slots request failed: %s. Using default slots.", exc)

    # Deterministic default business-hour consultation slots if live Cal.com is unconfigured
    default_slots: list[dict[str, str]] = []
    base_day = now + timedelta(days=1)
    if base_day.weekday() >= 5:  # weekend skip
        base_day += timedelta(days=(7 - base_day.weekday()))

    for day_offset in range(min(days_ahead, 3)):
        slot_day = base_day + timedelta(days=day_offset)
        if slot_day.weekday() < 5:  # Monday to Friday
            for hour in (14, 16):  # 14:00 UTC, 16:00 UTC
                s_dt = slot_day.replace(hour=hour, minute=0, second=0, microsecond=0)
                e_dt = s_dt + timedelta(minutes=duration_min)
                default_slots.append(
                    {
                        "start": s_dt.isoformat().replace("+00:00", "Z"),
                        "end": e_dt.isoformat().replace("+00:00", "Z"),
                    }
                )
    return default_slots[:6]


async def create_booking_hold(
    ctx: RunContext[AgentDeps],
    starts_at: str,
    ends_at: str,
    timezone_name: str,
    meeting_type_key: str = "discovery_call",
    intake_summary: str = "",
) -> dict[str, Any]:
    """Hold a proposed consultation time slot for 15 minutes in public.booking_proposals.

    Args:
        ctx: Agent run context.
        starts_at: ISO-8601 start timestamp.
        ends_at: ISO-8601 end timestamp.
        timezone_name: Client timezone (e.g. 'America/New_York').
        meeting_type_key: 'discovery_call' or 'technical_consult'.
        intake_summary: Summary of project needs or client inquiry.

    Returns:
        Booking proposal record with proposal_id, status='open', and expires_at.
    """
    pool = ctx.deps.db_pool if ctx else None
    conv_id = ctx.deps.conversation_id if ctx else None

    # Parse and validate timestamps
    try:
        start_time = datetime.fromisoformat(starts_at.replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
    except ValueError as exc:
        return {"status": "error", "message": f"Invalid timestamp format: {exc}"}

    if end_time <= start_time:
        return {"status": "error", "message": "ends_at must be strictly after starts_at."}

    if pool is None or not conv_id:
        return {
            "status": "held",
            "proposal_id": "test-proposal-id",
            "starts_at": starts_at,
            "ends_at": ends_at,
            "timezone": timezone_name,
            "expires_in_minutes": 15,
            "message": "Slot held for 15 minutes. Please proceed to confirmation.",
        }

    try:
        async with pool.acquire() as conn:
            # Check or ensure session exists
            session_uuid: UUID
            try:
                session_uuid = UUID(conv_id)
            except ValueError:
                import uuid

                session_uuid = uuid.uuid4()

            await conn.execute(
                """
                INSERT INTO public.chat_sessions (id, locale, status)
                VALUES ($1, $2, 'active')
                ON CONFLICT (id) DO NOTHING;
                """,
                session_uuid,
                ctx.deps.locale if ctx.deps.locale in ("en", "bn") else "en",
            )

            # Lookup meeting_type_id
            mt_row = await conn.fetchrow(
                "SELECT id FROM public.meeting_types WHERE key = $1 AND is_active = true",
                meeting_type_key,
            )
            if not mt_row:
                mt_row = await conn.fetchrow(
                    "SELECT id FROM public.meeting_types WHERE is_active = true ORDER BY sort_order LIMIT 1"
                )
            meeting_type_id = mt_row["id"] if mt_row else None

            if not meeting_type_id:
                return {"status": "error", "message": "Meeting type not found in database."}

            row = await conn.fetchrow(
                INSERT_PROPOSAL_SQL,
                session_uuid,
                meeting_type_id,
                start_time,
                end_time,
                timezone_name,
                intake_summary,
            )
            return {
                "status": "held",
                "proposal_id": str(row["id"]),
                "starts_at": row["starts_at"].isoformat(),
                "ends_at": row["ends_at"].isoformat(),
                "timezone": row["timezone"],
                "expires_at": row["expires_at"].isoformat(),
                "message": "Slot successfully reserved for 15 minutes. Awaiting confirmation.",
            }
    except Exception as exc:
        logger.error("Failed to hold booking proposal: %s", exc)
        return {"status": "error", "message": f"Could not create booking proposal: {exc}"}
