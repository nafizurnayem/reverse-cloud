"""Conversation state and approval rules."""

from __future__ import annotations

import re
from enum import StrEnum

from pydantic import BaseModel, Field

from ..schemas.chat import ChatMessage


class ConversationPhase(StrEnum):
    DISCOVERY = "discovery"
    QUALIFICATION = "qualification"
    ESTIMATING = "estimating"
    SCHEDULING = "scheduling"
    LEAD_CAPTURE = "lead_capture"
    HANDOFF = "handoff"
    PROJECT_SUPPORT = "project_support"


class PendingAction(BaseModel):
    action: str
    payload: dict[str, object] = Field(default_factory=dict)
    idempotency_key: str


class ConversationState(BaseModel):
    phase: ConversationPhase = ConversationPhase.DISCOVERY
    collected_fields: dict[str, str] = Field(default_factory=dict)
    pending_action: PendingAction | None = None
    version: int = 1


def has_explicit_save_confirmation(messages: list[ChatMessage]) -> bool:
    """Compatibility rule until pending actions are persisted server-side."""
    if len(messages) < 2 or messages[-1].role != "user" or messages[-2].role != "assistant":
        return False
    asked = re.search(r"\b(confirm|save|record)\b|নিশ্চিত|সংরক্ষণ", messages[-2].content, re.IGNORECASE)
    agreed = re.fullmatch(
        r"\s*(yes|confirm|confirmed|go ahead|please do|ok(?:ay)?|হ্যাঁ|জি|ঠিক আছে)\s*[.!]?\s*",
        messages[-1].content,
        re.IGNORECASE,
    )
    return bool(asked and agreed)
