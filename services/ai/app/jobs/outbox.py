"""Deliver pending email and Telegram notifications with retry backoff."""

from __future__ import annotations

import asyncio
import html
import json
import logging
import socket
from typing import Any
from uuid import uuid4

import asyncpg
import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

TELEGRAM_MAX_CHARS = 4096

CLAIM_SQL = """
with ready as (
  select id
  from public.notifications_outbox
  where status = 'pending'
    and channel = any($4::text[])
    and run_after <= now()
    and (locked_at is null or locked_at < now() - ($1 * interval '1 second'))
  order by run_after, created_at
  for update skip locked
  limit $2
)
update public.notifications_outbox n
set locked_at = now(), locked_by = $3, attempts = n.attempts + 1
from ready
where n.id = ready.id
returning n.*
"""


def _payload(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        decoded = json.loads(value)
        return decoded if isinstance(decoded, dict) else {}
    return {}


def _lead_text(payload: dict[str, Any]) -> str:
    fields = [
        ("Name", payload.get("name")),
        ("Email", payload.get("email")),
        ("Phone", payload.get("phone")),
        ("Company", payload.get("company")),
        ("Country", payload.get("country")),
        ("Locale", payload.get("locale")),
        ("Lead ID", payload.get("lead_id")),
    ]
    lines = ["New Reverse Cloud enquiry"]
    lines.extend(f"{label}: {value}" for label, value in fields if value)
    lines.extend(("", "Message:", str(payload.get("message") or "")))
    return "\n".join(lines)


def _telegram_text(payload: dict[str, Any]) -> str:
    """Telegram refuses messages longer than 4096 characters."""
    text = _lead_text(payload)
    if len(text) <= TELEGRAM_MAX_CHARS:
        return text
    suffix = "\n[message shortened]"
    return text[: TELEGRAM_MAX_CHARS - len(suffix)] + suffix


def _configured_channels(settings: Settings) -> list[str]:
    """Only channels with credentials are claimed, so missing keys never use up attempts."""
    channels: list[str] = []
    if settings.email_api_key and settings.email_from:
        channels.append("email")
    if settings.telegram_bot_token:
        channels.append("telegram")
    return channels


def _safe_error(error: Exception) -> str:
    if isinstance(error, httpx.HTTPStatusError):
        return f"Notification provider returned HTTP {error.response.status_code}"
    if isinstance(error, httpx.HTTPError):
        return "Notification provider request failed"
    if isinstance(error, RuntimeError):
        return str(error)[:1000]
    return f"Delivery failed ({type(error).__name__})"


async def _send_email(client: httpx.AsyncClient, row: asyncpg.Record, settings: Settings) -> None:
    if not settings.email_api_key or not settings.email_from:
        raise RuntimeError("EMAIL_API_KEY and EMAIL_FROM are required")
    payload = _payload(row["payload"])
    text = _lead_text(payload)
    response = await client.post(
        settings.email_api_url,
        headers={"authorization": f"Bearer {settings.email_api_key}"},
        json={
            "from": settings.email_from,
            "to": [row["to_address"]],
            "subject": f"New website lead: {payload.get('name') or 'Unknown'}",
            "text": text,
            "html": f"<pre>{html.escape(text)}</pre>",
        },
    )
    response.raise_for_status()


async def _send_telegram(client: httpx.AsyncClient, row: asyncpg.Record, settings: Settings) -> None:
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required")
    response = await client.post(
        f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
        json={"chat_id": row["to_address"], "text": _telegram_text(_payload(row["payload"]))},
    )
    response.raise_for_status()
    result = response.json()
    if result.get("ok") is not True:
        raise RuntimeError("Telegram rejected the notification")


def _invite_email(payload: dict[str, Any], settings: Settings) -> tuple[str, str, str]:
    locale = payload.get("locale") or "en"
    client_name = payload.get("client_name") or "Valued Client"
    token = payload.get("token") or ""
    site_url = getattr(settings, "site_url", "https://reversecloud.io").rstrip("/")
    invite_url = f"{site_url}/{locale}/accept-invite?token={token}"

    if locale == "bn":
        subject = "রিভার্স ক্লাউড ক্লায়েন্ট পোর্টালে আপনার আমন্ত্রণ"
        text = (
            f"প্রিয় {client_name},\n\n"
            "আমাদের ইঞ্জিনিয়ারিং দল আপনার প্রজেক্টের জন্য ক্লায়েন্ট পোর্টাল প্রস্তুত করেছে। এই পোর্টালের মাধ্যমে আপনি রিয়েল-টাইমে দেখতে পারবেন:\n"
            "- মাইলফলক অগ্রগতি ও টাইমলাইন\n"
            "- লাইভ স্টেজিং প্রিভিউ লিংক\n"
            "- পেমেন্ট শিডিউল ও ইনভয়েস\n\n"
            f"পোর্টালে প্রবেশ করুন:\n{invite_url}\n\n"
            "আমন্ত্রণ লিঙ্কটি ৩৩৬ ঘণ্টা সক্রিয় থাকবে।"
        )
        html_content = (
            f'<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">\n'
            f'  <h2 style="color: #0f172a;">স্বাগতম, {html.escape(client_name)}!</h2>\n'
            f'  <p>আমাদের ইঞ্জিনিয়ারিং দল আপনার প্রজেক্টের জন্য ক্লায়েন্ট পোর্টাল প্রস্তুত করেছে। এই পোর্টালের মাধ্যমে আপনি সরাসরি দেখতে পারবেন:</p>\n'
            f'  <ul style="padding-left: 20px; color: #475569;">\n'
            f'    <li>রিয়েল-টাইম মাইলফলক এবং ডেলিভারি অগ্রগতি</li>\n'
            f'    <li>লাইভ স্টেজিং প্রিভিউ পরিবেশ এবং টেস্ট লিংক</li>\n'
            f'    <li>পেমেন্ট শিডিউল এবং অফিশিয়াল ইনভয়েস ডাউনলোড</li>\n'
            f'  </ul>\n'
            f'  <p style="margin: 24px 0;">\n'
            f'    <a href="{html.escape(invite_url)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">পোর্টালে প্রবেশ করুন</a>\n'
            f'  </p>\n'
            f'  <p style="font-size: 14px; color: #64748b;">নিরাপত্তার স্বার্থে এই আমন্ত্রণ লিঙ্কটি ৩৩৬ ঘণ্টার মধ্যে ব্যবহার করতে হবে।</p>\n'
            f'</div>'
        )
    else:
        subject = "Invitation: Access your Reverse Cloud Client Portal"
        text = (
            f"Hello {client_name},\n\n"
            "Our engineering team has provisioned your dedicated client portal. You can now access:\n"
            "- Real-time milestone progress and timeline\n"
            "- Live staging preview links\n"
            "- Payment disbursements and downloadable invoices\n\n"
            f"Activate your client portal:\n{invite_url}\n\n"
            "This invitation link is valid for 14 days (336 hours)."
        )
        html_content = (
            f'<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">\n'
            f'  <h2 style="color: #0f172a;">Welcome to Reverse Cloud, {html.escape(client_name)}!</h2>\n'
            f'  <p>Our engineering team has provisioned your dedicated client portal. Through this portal, you have real-time read-only access to:</p>\n'
            f'  <ul style="padding-left: 20px; color: #475569;">\n'
            f'    <li>Real-time milestone timelines and delivery weights</li>\n'
            f'    <li>Isolated live staging preview deployments</li>\n'
            f'    <li>Milestone payment disbursements and official invoices</li>\n'
            f'  </ul>\n'
            f'  <p style="margin: 24px 0;">\n'
            f'    <a href="{html.escape(invite_url)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Access Client Portal</a>\n'
            f'  </p>\n'
            f'  <p style="font-size: 14px; color: #64748b;">For your security, this invitation link remains valid for 336 hours.</p>\n'
            f'</div>'
        )

    return subject, text, html_content


def _payment_reminder_email(payload: dict[str, Any]) -> tuple[str, str, str]:
    title = payload.get("title") or "Milestone Payment"
    amount = payload.get("amount_due") or 0
    currency = payload.get("currency") or "USD"
    due_on = payload.get("due_on") or "soon"
    client_name = payload.get("client_name") or "Valued Client"

    subject = f"Payment Reminder: {title} ({amount} {currency})"
    text = (
        f"Hello {client_name},\n\n"
        f"This is a reminder that payment for '{title}' ({amount} {currency}) is due on {due_on}.\n"
        "Please visit your client portal to review payment instructions and invoice details."
    )
    html_content = (
        f'<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">\n'
        f'  <h2 style="color: #0f172a;">Payment Reminder</h2>\n'
        f'  <p>Hello {html.escape(client_name)},</p>\n'
        f'  <p>Payment for <strong>{html.escape(str(title))}</strong> ({amount} {currency}) is scheduled for <strong>{html.escape(str(due_on))}</strong>.</p>\n'
        f'  <p>Please log in to your portal to review and disburse payment.</p>\n'
        f'</div>'
    )
    return subject, text, html_content


async def _send_invite_email(client: httpx.AsyncClient, row: asyncpg.Record, settings: Settings) -> None:
    if not settings.email_api_key or not settings.email_from:
        raise RuntimeError("EMAIL_API_KEY and EMAIL_FROM are required")
    payload = _payload(row["payload"])
    subject, text, html_content = _invite_email(payload, settings)
    response = await client.post(
        settings.email_api_url,
        headers={"authorization": f"Bearer {settings.email_api_key}"},
        json={
            "from": settings.email_from,
            "to": [row["to_address"]],
            "subject": subject,
            "text": text,
            "html": html_content,
        },
    )
    response.raise_for_status()


async def _send_payment_reminder_email(client: httpx.AsyncClient, row: asyncpg.Record, settings: Settings) -> None:
    if not settings.email_api_key or not settings.email_from:
        raise RuntimeError("EMAIL_API_KEY and EMAIL_FROM are required")
    payload = _payload(row["payload"])
    subject, text, html_content = _payment_reminder_email(payload)
    response = await client.post(
        settings.email_api_url,
        headers={"authorization": f"Bearer {settings.email_api_key}"},
        json={
            "from": settings.email_from,
            "to": [row["to_address"]],
            "subject": subject,
            "text": text,
            "html": html_content,
        },
    )
    response.raise_for_status()


async def _alert_outbox_failure(
    client: httpx.AsyncClient,
    row: asyncpg.Record,
    error_text: str,
    settings: Settings,
) -> None:
    """Send an alert to staff when an outbox message exhausts all retries and terminally fails."""
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return
    text = (
        f"🚨 <b>Outbox Delivery Failure</b>\n"
        f"ID: <code>{row['id']}</code>\n"
        f"Template: {html.escape(str(row['template']))}\n"
        f"Channel: {html.escape(str(row['channel']))}\n"
        f"Recipient: {html.escape(str(row['to_address']))}\n"
        f"Attempts: {row['attempts']}\n"
        f"Error: {html.escape(error_text)}"
    )
    try:
        await client.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
            json={
                "chat_id": settings.telegram_chat_id,
                "text": text,
                "parse_mode": "HTML",
            },
            timeout=5.0,
        )
    except Exception as exc:
        logger.warning("Failed to send terminal outbox alert to Telegram: %s", exc)


async def _deliver(client: httpx.AsyncClient, row: asyncpg.Record, settings: Settings) -> None:
    template = row["template"]
    if template == "new_lead":
        if row["channel"] == "email":
            await _send_email(client, row, settings)
        elif row["channel"] == "telegram":
            await _send_telegram(client, row, settings)
        else:
            raise RuntimeError(f"Unsupported notification channel: {row['channel']}")
    elif template == "client_invite":
        if row["channel"] != "email":
            raise RuntimeError("client_invite only supports email delivery")
        await _send_invite_email(client, row, settings)
    elif template == "payment_due_reminder":
        if row["channel"] != "email":
            raise RuntimeError("payment_due_reminder only supports email delivery")
        await _send_payment_reminder_email(client, row, settings)
    else:
        raise RuntimeError(f"Unsupported notification template: {template}")


async def process_outbox(settings: Settings | None = None) -> tuple[int, int]:
    settings = settings or get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL_AI is required for the outbox worker")
    channels = _configured_channels(settings)
    if not channels:
        logger.warning("No notification provider is configured; leaving the outbox untouched")
        return 0, 0
    worker_id = f"{socket.gethostname()}:{uuid4()}"
    connection = await asyncpg.connect(settings.database_url)
    try:
        rows = await connection.fetch(
            CLAIM_SQL,
            settings.outbox_lock_timeout_seconds,
            settings.outbox_batch_size,
            worker_id,
            channels,
        )
        if not rows:
            return 0, 0
        completed = 0
        failed = 0
        async with httpx.AsyncClient(timeout=15) as client:
            for row in rows:
                try:
                    await _deliver(client, row, settings)
                    await connection.execute(
                        """update public.notifications_outbox
                        set status = 'sent', sent_at = now(), last_error = null,
                            locked_at = null, locked_by = null
                        where id = $1 and locked_by = $2""",
                        row["id"], worker_id,
                    )
                    completed += 1
                except Exception as error:  # The row records a safe retry message.
                    failed += 1
                    error_text = _safe_error(error)
                    terminal = row["attempts"] >= settings.outbox_max_attempts
                    delay_seconds = min(3600, 30 * (2 ** max(0, row["attempts"] - 1)))
                    await connection.execute(
                        """update public.notifications_outbox
                        set status = $3, last_error = $4,
                            run_after = now() + ($5 * interval '1 second'),
                            locked_at = null, locked_by = null
                        where id = $1 and locked_by = $2""",
                        row["id"], worker_id, "failed" if terminal else "pending",
                        error_text, delay_seconds,
                    )
                    if terminal:
                        await _alert_outbox_failure(client, row, error_text, settings)
                    logger.warning(
                        "Outbox delivery failed for %s (attempt %s, %s): %s",
                        row["id"], row["attempts"], "gave up" if terminal else "will retry", error_text,
                    )
        return completed, failed
    finally:
        await connection.close()


async def _main() -> None:
    logging.basicConfig(level=logging.INFO)
    completed, failed = await process_outbox()
    logger.info("Outbox run finished: %s sent, %s failed", completed, failed)


if __name__ == "__main__":
    asyncio.run(_main())