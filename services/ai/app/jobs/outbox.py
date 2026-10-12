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

CLAIM_SQL = """
with ready as (
  select id
  from public.notifications_outbox
  where status = 'pending'
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
		json={"chat_id": row["to_address"], "text": _lead_text(_payload(row["payload"]))},
	)
	response.raise_for_status()
	result = response.json()
	if result.get("ok") is not True:
		raise RuntimeError("Telegram rejected the notification")


async def _deliver(client: httpx.AsyncClient, row: asyncpg.Record, settings: Settings) -> None:
	if row["template"] != "new_lead":
		raise RuntimeError(f"Unsupported notification template: {row['template']}")
	if row["channel"] == "email":
		await _send_email(client, row, settings)
	elif row["channel"] == "telegram":
		await _send_telegram(client, row, settings)
	else:
		raise RuntimeError(f"Unsupported notification channel: {row['channel']}")


async def process_outbox(settings: Settings | None = None) -> tuple[int, int]:
	settings = settings or get_settings()
	if not settings.database_url:
		raise RuntimeError("DATABASE_URL_AI is required for the outbox worker")
	worker_id = f"{socket.gethostname()}:{uuid4()}"
	connection = await asyncpg.connect(settings.database_url)
	try:
		rows = await connection.fetch(
			CLAIM_SQL,
			settings.outbox_lock_timeout_seconds,
			settings.outbox_batch_size,
			worker_id,
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
					terminal = row["attempts"] >= settings.outbox_max_attempts
					delay_seconds = min(3600, 30 * (2 ** max(0, row["attempts"] - 1)))
					await connection.execute(
						"""update public.notifications_outbox
						set status = $3, last_error = $4,
						    run_after = now() + ($5 * interval '1 second'),
						    locked_at = null, locked_by = null
						where id = $1 and locked_by = $2""",
						row["id"], worker_id, "failed" if terminal else "pending",
						_safe_error(error), delay_seconds,
					)
					logger.warning("Outbox delivery failed for %s", row["id"])
		return completed, failed
	finally:
		await connection.close()


async def _main() -> None:
	logging.basicConfig(level=logging.INFO)
	completed, failed = await process_outbox()
	logger.info("Outbox run finished: %s sent, %s failed", completed, failed)


if __name__ == "__main__":
	asyncio.run(_main())

