"""Client project status tool for Reverse Cloud AI agent (Phase 5).

Queries the get_client_project_status Postgres function defined in migration 0028,
returning client-safe milestones and updates with strict isolation from internal notes.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from pydantic_ai import RunContext

from ..agents.deps import AgentDeps

logger = logging.getLogger(__name__)

GET_PROJECT_STATUS_SQL = """
SELECT
    project_id,
    title,
    description,
    status,
    client_progress_pct,
    due_on,
    preview_url,
    milestones,
    recent_updates
FROM public.get_client_project_status($1, $2);
"""


async def get_project_status(
    ctx: RunContext[AgentDeps],
    project_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve verified delivery progress, active milestones, and client updates for a project.

    Clients must be authenticated. The client identity is read exclusively from the
    server-side verified request context - the model cannot supply or override it.
    Internal engineering notes and financial budgets are stripped at the DB level (migration 0028).

    Args:
        ctx: Agent run context.
        project_id: Optional specific project UUID if the client has multiple active projects.

    Returns:
        Dictionary containing project progress percentage, milestones, and public updates.
    """
    # FX-03: client_id is intentionally NOT a tool parameter. It must come only from
    # the server-signed request context (set by the Next.js API route after verifying
    # the session). This prevents the model from querying any other client's data.
    effective_client_id = ctx.deps.client_id if ctx else None
    if not effective_client_id:
        return {
            "error": "authentication_required",
            "message": "Please sign in to your client portal to view project status.",
        }

    try:
        client_uuid = UUID(effective_client_id)
        proj_uuid = UUID(project_id) if project_id else None
    except ValueError as exc:
        return {"error": "invalid_uuid", "message": f"Invalid UUID identifier: {exc}"}

    pool = ctx.deps.db_pool if ctx else None
    if pool is None:
        return {
            "error": "service_unavailable",
            "message": "Project status is temporarily unavailable. Please try again later.",
        }

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(GET_PROJECT_STATUS_SQL, client_uuid, proj_uuid)
            if not rows:
                return {
                    "status": "not_found",
                    "message": "No active project found matching the specified client account.",
                }

            projects: list[dict[str, Any]] = []
            for r in rows:
                milestones_data = r["milestones"]
                if isinstance(milestones_data, str):
                    milestones_data = json.loads(milestones_data)

                updates_data = r["recent_updates"]
                if isinstance(updates_data, str):
                    updates_data = json.loads(updates_data)

                projects.append(
                    {
                        "project_id": str(r["project_id"]),
                        "title": r["title"],
                        "description": r["description"],
                        "status": r["status"],
                        "client_progress_pct": float(r["client_progress_pct"]) if r["client_progress_pct"] is not None else 0.0,
                        "due_on": str(r["due_on"]) if r["due_on"] else None,
                        "preview_url": r["preview_url"],
                        "milestones": milestones_data or [],
                        "recent_updates": updates_data or [],
                    }
                )

            return {"projects": projects, "total_projects": len(projects)}
    except Exception as exc:
        logger.error("Failed to query get_client_project_status: %s", exc, exc_info=True)
        # FX-25: never expose raw exception text to the model/user
        return {"error": "query_failed", "message": "Project status is temporarily unavailable. Please try again later."}
