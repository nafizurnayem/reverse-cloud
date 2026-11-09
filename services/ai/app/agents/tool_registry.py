"""Single registry for agent capabilities and their UI card contracts."""

from __future__ import annotations

from pydantic_ai import Agent

from ..tools.estimate import get_estimate
from ..tools.human_handoff import request_human_handoff
from ..tools.knowledge_search import search_knowledge
from ..tools.project_status import get_project_status
from ..tools.save_lead import save_lead
from ..tools.scheduling import create_booking_hold, get_available_slots
from ..tools.services import list_services

TOOL_CARD_TYPES: dict[str, str] = {
    "create_booking_hold": "booking_proposal",
    "get_estimate": "estimate",
    "save_lead": "lead_saved",
    "request_human_handoff": "human_handoff",
    "get_project_status": "project_status",
}


def register_tools(agent: Agent) -> None:
    agent.tool(search_knowledge)
    agent.tool(list_services)
    agent.tool(get_estimate)
    agent.tool(save_lead)
    agent.tool(request_human_handoff)
    agent.tool(get_available_slots)
    agent.tool(create_booking_hold)
    agent.tool(get_project_status)
