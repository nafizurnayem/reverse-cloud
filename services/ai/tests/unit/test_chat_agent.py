"""Unit tests for Reverse Cloud PydanticAI chat agent."""

import pytest
from pydantic_ai.models.test import TestModel
from types import SimpleNamespace

from app.agents import model_factory
from app.agents.chat_agent import (
    CardEvent,
    TextChunk,
    UsageEvent,
    convert_chat_messages,
    create_chat_agent,
    load_system_prompt,
    resolve_model,
    run_agent_stream,
)
from app.schemas.chat import ChatMessage, ChatRequest


def test_system_prompt_loading() -> None:
    en_prompt = load_system_prompt("en")
    bn_prompt = load_system_prompt("bn")

    assert "Reverse Cloud" in en_prompt
    assert "রিভার্স ক্লাউড" in bn_prompt
    assert "reverscloud" not in en_prompt.lower()
    assert len(en_prompt) > 200
    assert len(bn_prompt) > 200


def test_convert_chat_messages() -> None:
    msgs = [
        ChatMessage(role="user", content="Hi"),
        ChatMessage(role="assistant", content="Hello! How can I help?"),
        ChatMessage(role="user", content="How much for a web app?"),
    ]
    prompt, history = convert_chat_messages(msgs)

    assert prompt == "How much for a web app?"
    assert len(history) == 2


def test_create_chat_agent_registers_tools() -> None:
    agent = create_chat_agent(model=TestModel())
    # Verify tools registered in agent
    tool_names = set(agent._function_toolset.tools.keys())
    expected = {
        "search_knowledge",
        "list_services",
        "get_estimate",
        "save_lead",
        "request_human_handoff",
        "get_available_slots",
        "create_booking_hold",
        "get_project_status",
    }
    assert expected.issubset(tool_names)


def test_resolve_model_uses_ollama_when_configured(monkeypatch) -> None:
    monkeypatch.setattr(
        model_factory,
        "get_settings",
        lambda: SimpleNamespace(
            ollama_url="http://localhost:11434/",
            ollama_model="llama3.2:1b",
            llm_api_key=None,
        ),
    )
    monkeypatch.setattr(model_factory, "OllamaProvider", lambda **kwargs: kwargs)
    monkeypatch.setattr(
        model_factory,
        "OllamaModel",
        lambda model, provider: (model, provider),
    )

    assert resolve_model() == (
        "llama3.2:1b",
        {"base_url": "http://localhost:11434/v1"},
    )


def test_resolve_model_falls_back_from_ollama_to_gemini(monkeypatch) -> None:
    monkeypatch.setattr(
        model_factory,
        "get_settings",
        lambda: SimpleNamespace(
            ollama_url="http://localhost:11434",
            ollama_model="llama3.2:1b",
            llm_api_key="gemini-key",
            llm_model="gemini-3.5-flash",
            gemini_api_key=None,
        ),
    )
    monkeypatch.setattr(model_factory, "OllamaProvider", lambda **kwargs: kwargs)
    monkeypatch.setattr(model_factory, "OllamaModel", lambda model, provider: ("ollama", model, provider))
    monkeypatch.setattr(model_factory, "GoogleProvider", lambda **kwargs: kwargs)
    monkeypatch.setattr(model_factory, "GoogleModel", lambda model, provider: ("gemini", model, provider))
    monkeypatch.setattr(
        model_factory,
        "FallbackModel",
        lambda *models, **kwargs: ("fallback", *models, kwargs),
    )

    assert resolve_model() == (
        "fallback",
        ("ollama", "llama3.2:1b", {"base_url": "http://localhost:11434/v1"}),
        ("gemini", "gemini-3.5-flash", {"api_key": "gemini-key"}),
        {
            "fallback_on": (
                model_factory.ModelAPIError,
                model_factory.UnexpectedModelBehavior,
            )
        },
    )


@pytest.mark.asyncio
async def test_run_agent_stream_with_test_model() -> None:
    test_model = TestModel(
        call_tools=[],
        custom_output_text="Reverse Cloud builds production web apps.",
    )
    payload = ChatRequest(
        messages=[
            ChatMessage(role="user", content="What do you build?"),
        ],
        locale="en",
        conversation_id="33333333-3333-4333-8333-333333333333",
    )

    chunks: list[str] = []
    async for delta in run_agent_stream(payload, model=test_model):
        if isinstance(delta, TextChunk):
            chunks.append(delta.text)
        elif isinstance(delta, CardEvent):
            assert isinstance(delta, CardEvent)
        else:
            assert isinstance(delta, UsageEvent)

    full_text = "".join(chunks)
    assert "Reverse Cloud builds production web apps." in full_text
