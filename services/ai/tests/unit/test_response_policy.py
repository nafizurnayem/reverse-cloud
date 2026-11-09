from types import SimpleNamespace

import pytest

from app.application.chat_service import ChatService
from app.domain.response_policy import direct_reply, ensure_useful_reply
from app.schemas.chat import ChatMessage, ChatRequest


def test_direct_greetings_are_localized() -> None:
    assert "Welcome to Reverse Cloud" in (direct_reply("Hi!", "en") or "")
    assert "রিভার্স ক্লাউডে স্বাগতম" in (direct_reply("হ্যালো", "bn") or "")
    assert direct_reply("I need a website", "en") is None


def test_unhelpful_and_repetitive_model_output_is_replaced() -> None:
    assert "couldn’t verify" in ensure_useful_reply("I don't know.", "en")
    assert "নির্ভরযোগ্য উত্তর" in ensure_useful_reply("জানি না", "bn")
    assert "couldn’t verify" in ensure_useful_reply("garbage " * 12, "en")
    assert ensure_useful_reply("We can help plan your web application.", "en") == (
        "We can help plan your web application."
    )


@pytest.mark.asyncio
async def test_chat_service_greeting_never_calls_model() -> None:
    async def failing_runner(*_args, **_kwargs):
        raise AssertionError("The model must not run for a greeting")
        yield  # pragma: no cover

    service = ChatService(
        agent_runner=failing_runner,
        settings=SimpleNamespace(ai_enabled=True),
    )
    request = ChatRequest(messages=[ChatMessage(role="user", content="hello")], locale="en")

    events = [event async for event in service.run_turn(request)]

    assert [event.event for event in events] == ["message_start", "text_delta", "message_end"]
    assert "Welcome to Reverse Cloud" in events[1].data["text"]
