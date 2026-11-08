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
    api_key = (ctx.deps.calcom_api_key if ctx else None) or settings.calcom_api_key

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

    if not api_key or not event_type_id:
        # FX-14: never invent slots when Cal.com is not configured.
        logger.warning("Cal.com not configured (api_key=%s, event_type_id=%s); returning unavailable.", bool(api_key), event_type_id)
        return [{"error": "availability_unavailable", "message": "Scheduling is not available right now. Please contact us directly to arrange a call."}]

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
            logger.warning("Cal.com slots API returned non-success status %s", res.status_code)
    except Exception as exc:
        # FX-14: do not fall back to invented slots; surface the real error
        logger.warning("Cal.com API slots request failed: %s", exc)

    return [{"error": "availability_unavailable", "message": "Unable to retrieve live availability right now. Please try again in a moment or contact us directly."}]


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
            "status": "error",
            "message": "Unable to hold this slot right now. Please use the scheduling page.",
        }

    # FX-14: recheck that the requested slot is still live before holding it.
    settings = get_settings()
    api_key = (ctx.deps.calcom_api_key if ctx else None) or settings.calcom_api_key
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as http_client:
                pool_check = await ctx.deps.db_pool.acquire() if ctx.deps.db_pool else None
                event_type_id: str | None = None
                if pool_check is not None:
                    try:
                        mt = await pool_check.fetchrow(SELECT_MEETING_TYPE_SQL, meeting_type_key)
                        if mt:
                            event_type_id = mt["calcom_event_type_id"]
                    finally:
                        await ctx.deps.db_pool.release(pool_check)

                if event_type_id:
                    check_res = await http_client.get(
                        "https://api.cal.com/v2/slots",
                        params={
                            "eventTypeId": event_type_id,
                            "start": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "end": end_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "timeZone": timezone_name,
                            "format": "range",
                        },
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "cal-api-version": CALCOM_API_VERSION,
                        },
                    )
                    if check_res.is_success:
                        live_slots = check_res.json().get("data", {}).get("slots", [])
                        starts_iso = start_time.strftime("%Y-%m-%dT%H:%M:%S")
                        slot_available = any(
                            s.get("start", "").startswith(starts_iso[:16])
                            for s in live_slots
                        )
                        if not slot_available:
                            return {
                                "status": "error",
                                "message": "That slot is no longer available. Please choose a different time.",
                            }
        except Exception as exc:
            logger.warning("Slot live-check failed: %s — proceeding with hold anyway.", exc)


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
        logger.error("Failed to hold booking proposal: %s", exc, exc_info=True)
        # FX-25: never expose raw exception text to the model/user
        return {"status": "error", "message": "Unable to hold this slot right now. Please try again or choose another time."}
