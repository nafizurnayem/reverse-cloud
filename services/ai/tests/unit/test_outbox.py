import httpx

from app.config import Settings
from app.jobs.outbox import (
    TELEGRAM_MAX_CHARS,
    _configured_channels,
    _lead_text,
    _payload,
    _safe_error,
    _telegram_text,
)


def test_lead_message_contains_contact_and_message() -> None:
    text = _lead_text({
        "lead_id": "lead-1",
        "name": "Nafiz",
        "email": "nafiz@example.com",
        "message": "I need a new website.",
    })
    assert "Name: Nafiz" in text
    assert "Email: nafiz@example.com" in text
    assert "I need a new website." in text


def test_payload_accepts_asyncpg_json_text() -> None:
    assert _payload('{"lead_id":"lead-1"}') == {"lead_id": "lead-1"}
    assert _payload("[]") == {}


def test_provider_errors_do_not_store_secret_urls() -> None:
    request = httpx.Request("POST", "https://api.telegram.org/botSECRET/sendMessage")
    response = httpx.Response(401, request=request)
    error = httpx.HTTPStatusError("bad response", request=request, response=response)
    message = _safe_error(error)
    assert message == "Notification provider returned HTTP 401"
    assert "SECRET" not in message


def test_only_configured_channels_are_claimed() -> None:
    both = Settings(email_api_key="k", email_from="a@example.com", telegram_bot_token="t")
    assert _configured_channels(both) == ["email", "telegram"]

    email_without_sender = Settings(email_api_key="k", email_from=None, telegram_bot_token="t")
    assert _configured_channels(email_without_sender) == ["telegram"]

    nothing = Settings(email_api_key=None, email_from=None, telegram_bot_token=None)
    assert _configured_channels(nothing) == []


def test_short_telegram_message_is_unchanged() -> None:
    payload = {"name": "Nafiz", "email": "nafiz@example.com", "message": "Hello"}
    assert _telegram_text(payload) == _lead_text(payload)


def test_long_telegram_message_is_shortened_to_the_limit() -> None:
    payload = {"name": "Nafiz", "email": "nafiz@example.com", "message": "x" * 5000}
    text = _telegram_text(payload)
    assert len(text) <= TELEGRAM_MAX_CHARS
    assert text.endswith("[message shortened]")
    assert "Name: Nafiz" in text