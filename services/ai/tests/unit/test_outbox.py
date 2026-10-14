import httpx

from app.config import Settings
from app.jobs.outbox import (
    TELEGRAM_MAX_CHARS,
    _configured_channels,
    _invite_email,
    _lead_text,
    _payment_reminder_email,
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


def test_invite_email_renders_english() -> None:
    settings = Settings(site_url="https://app.reversecloud.io")
    subject, text, html_content = _invite_email(
        {
            "client_name": "Rahim Chowdhury",
            "token": "secret-invite-token-123",
            "locale": "en",
        },
        settings,
    )
    assert subject == "Invitation: Access your Reverse Cloud Client Portal"
    assert "Rahim Chowdhury" in text
    assert "https://app.reversecloud.io/en/accept-invite?token=secret-invite-token-123" in text
    assert "https://app.reversecloud.io/en/accept-invite?token=secret-invite-token-123" in html_content
    assert "336 hours" in text


def test_invite_email_renders_bangla() -> None:
    settings = Settings(site_url="https://app.reversecloud.io")
    subject, text, html_content = _invite_email(
        {
            "client_name": "রহিম চৌধুরী",
            "token": "token-bn-456",
            "locale": "bn",
        },
        settings,
    )
    assert "রিভার্স ক্লাউড ক্লায়েন্ট পোর্টালে আপনার আমন্ত্রণ" in subject
    assert "রহিম চৌধুরী" in text
    assert "https://app.reversecloud.io/bn/accept-invite?token=token-bn-456" in text
    assert "৩৩৬ ঘণ্টা" in text


def test_payment_reminder_email_renders_correctly() -> None:
    subject, text, html_content = _payment_reminder_email({
        "title": "Milestone 1 Frontend",
        "amount_due": 2500,
        "currency": "USD",
        "due_on": "2026-11-01",
        "client_name": "Acme Corp",
    })
    assert "Milestone 1 Frontend" in subject
    assert "2500 USD" in subject
    assert "2026-11-01" in text
    assert "Acme Corp" in text