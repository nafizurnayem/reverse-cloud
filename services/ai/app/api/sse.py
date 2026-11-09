"""Server-sent event serialization."""

import json

from ..domain.events import ChatEvent


def encode_sse(event: ChatEvent) -> str:
    return f"event: {event.event}\ndata: {json.dumps(event.data)}\n\n"
