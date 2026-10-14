"""Database tests for the outbox worker: claiming, retries, locks and role limits.

These run against the LOCAL Supabase database only. They create the ai_service
role there and delete every row in notifications_outbox, so they refuse to run
against anything that is not localhost. If the database is not reachable (or the
migrations have not been applied) they are skipped, not failed.

No real email or Telegram message is ever sent: delivery is replaced by a
recorder, or by a fake HTTP transport.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import httpx
import pytest

from app.config import Settings
from app.jobs import outbox

# Default is the local Supabase database; override with TEST_ADMIN_DATABASE_URL.
ADMIN_URL = os.environ.get(
    "TEST_ADMIN_DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
AI_PASSWORD = "ai_service_local_test_only"

# Mirrors what must be done by hand on a real project: the migration only grants
# the worker access if the role already exists when it runs.
SETUP_SQL = f"""
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'ai_service') then
    create role ai_service login password '{AI_PASSWORD}';
  else
    alter role ai_service login password '{AI_PASSWORD}';
  end if;
end $$;
grant usage on schema public to ai_service;
grant select, update on public.notifications_outbox to ai_service;
"""


# ------------------------------------------------------------------ helpers
def _ai_url() -> str:
    parts = urlsplit(ADMIN_URL)
    netloc = f"ai_service:{AI_PASSWORD}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def admin(sql: str, *args: Any) -> list[asyncpg.Record]:
    """Run one statement as the database owner and return its rows."""

    async def go() -> list[asyncpg.Record]:
        connection = await asyncpg.connect(ADMIN_URL)
        try:
            return await connection.fetch(sql, *args)
        finally:
            await connection.close()

    return asyncio.run(go())


def add_row(
    channel: str = "email",
    template: str = "new_lead",
    *,
    attempts: int = 0,
    run_after_in: int = -60,
    locked_seconds_ago: int | None = None,
) -> str:
    """Insert one outbox row and return its id."""
    rows = admin(
        """insert into public.notifications_outbox
             (channel, to_address, template, payload, attempts, run_after, locked_at, locked_by)
           values ($1, $2, $3, '{"name":"Test Lead","message":"Hello"}'::jsonb, $4,
                   now() + make_interval(secs => $5),
                   case when $6::int is null then null
                        else now() - make_interval(secs => $6::int) end,
                   case when $6::int is null then null else 'dead-worker' end)
           returning id::text""",
        channel,
        "staff@example.com" if channel == "email" else "12345",
        template,
        attempts,
        float(run_after_in),
        locked_seconds_ago,
    )
    return rows[0]["id"]


def state(row_id: str) -> asyncpg.Record:
    return admin(
        """select status, attempts, last_error, locked_at, locked_by, sent_at,
                  extract(epoch from (run_after - now()))::float as seconds_until_retry
           from public.notifications_outbox where id = $1::uuid""",
        row_id,
    )[0]


def make_settings(url: str, **overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "email_api_key": "test-key",
        "email_from": "Reverse Cloud <noreply@example.com>",
        "telegram_bot_token": "test-token",
        "outbox_batch_size": 20,
        "outbox_max_attempts": 5,
        "outbox_lock_timeout_seconds": 900,
    }
    values.update(overrides)
    settings = Settings(**values)
    settings.database_url = url
    return settings


class Recorder:
    """Stands in for the real email/Telegram sending."""

    def __init__(self, fail: bool = False, delay: float = 0.0) -> None:
        self.fail = fail
        self.delay = delay
        self.delivered: list[str] = []

    async def __call__(self, client: Any, row: Any, settings: Any) -> None:
        self.delivered.append(str(row["id"]))
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail:
            raise RuntimeError("provider down")


def run_worker(settings: Settings) -> tuple[int, int]:
    return asyncio.run(outbox.process_outbox(settings))


# ----------------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def ai_url() -> str:
    host = urlsplit(ADMIN_URL).hostname
    if host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.skip("outbox database tests only run against a local database")

    async def setup() -> None:
        connection = await asyncpg.connect(ADMIN_URL)
        try:
            await connection.execute(SETUP_SQL)
        finally:
            await connection.close()

    try:
        asyncio.run(setup())
    except (OSError, asyncpg.PostgresError) as error:
        pytest.skip(f"local database is not ready: {error}")
    return _ai_url()


@pytest.fixture
def clean(ai_url: str):
    admin("delete from public.notifications_outbox")
    yield
    admin("delete from public.notifications_outbox")


# ------------------------------------------------------------ claiming rows
def test_pending_rows_are_sent(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder()
    monkeypatch.setattr(outbox, "_deliver", recorder)
    email_id = add_row("email")
    telegram_id = add_row("telegram")

    assert run_worker(make_settings(ai_url)) == (2, 0)

    for row_id in (email_id, telegram_id):
        row = state(row_id)
        assert row["status"] == "sent"
        assert row["sent_at"] is not None
        assert row["attempts"] == 1
        assert row["last_error"] is None
        assert row["locked_at"] is None and row["locked_by"] is None


def test_rows_not_due_yet_are_skipped(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder()
    monkeypatch.setattr(outbox, "_deliver", recorder)
    row_id = add_row(run_after_in=3600)

    assert run_worker(make_settings(ai_url)) == (0, 0)
    assert recorder.delivered == []
    assert state(row_id)["attempts"] == 0


def test_sent_and_failed_rows_are_never_picked_up_again(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder()
    monkeypatch.setattr(outbox, "_deliver", recorder)
    sent_id = add_row()
    admin("update public.notifications_outbox set status = 'sent', sent_at = now() where id = $1::uuid", sent_id)
    failed_id = add_row(attempts=5)
    admin("update public.notifications_outbox set status = 'failed' where id = $1::uuid", failed_id)

    assert run_worker(make_settings(ai_url)) == (0, 0)
    assert recorder.delivered == []


# ------------------------------------------------------------------ retries
def test_failed_delivery_is_retried_later(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder(fail=True)
    monkeypatch.setattr(outbox, "_deliver", recorder)
    row_id = add_row()

    assert run_worker(make_settings(ai_url)) == (0, 1)

    row = state(row_id)
    assert row["status"] == "pending"
    assert row["attempts"] == 1
    assert row["last_error"] == "provider down"
    assert row["seconds_until_retry"] > 0
    assert row["locked_at"] is None and row["locked_by"] is None

    # Straight away, nothing is due, so the provider is not called again.
    assert run_worker(make_settings(ai_url)) == (0, 0)
    assert len(recorder.delivered) == 1


def test_retry_delay_grows_with_each_attempt(monkeypatch, ai_url, clean) -> None:
    monkeypatch.setattr(outbox, "_deliver", Recorder(fail=True))
    first = add_row(attempts=0)    # becomes attempt 1 -> wait 30 seconds
    third = add_row(attempts=2)    # becomes attempt 3 -> wait 120 seconds

    run_worker(make_settings(ai_url))

    assert 20 < state(first)["seconds_until_retry"] <= 31
    assert 100 < state(third)["seconds_until_retry"] <= 121


def test_gives_up_after_the_maximum_attempts(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder(fail=True)
    monkeypatch.setattr(outbox, "_deliver", recorder)
    row_id = add_row(attempts=4)  # this run is attempt 5 of 5

    assert run_worker(make_settings(ai_url)) == (0, 1)

    row = state(row_id)
    assert row["status"] == "failed"
    assert row["attempts"] == 5
    assert row["last_error"] == "provider down"

    admin("update public.notifications_outbox set run_after = now() - interval '1 hour'")
    assert run_worker(make_settings(ai_url)) == (0, 0)
    assert len(recorder.delivered) == 1


# ------------------------------------------------------------ missing keys
def test_rows_for_an_unconfigured_channel_wait(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder()
    monkeypatch.setattr(outbox, "_deliver", recorder)
    email_id = add_row("email")
    telegram_id = add_row("telegram")

    settings = make_settings(ai_url, email_api_key=None, email_from=None)
    assert run_worker(settings) == (1, 0)

    assert state(telegram_id)["status"] == "sent"
    waiting = state(email_id)
    assert waiting["status"] == "pending"
    assert waiting["attempts"] == 0          # missing keys do not use up attempts
    assert waiting["locked_at"] is None


def test_nothing_is_touched_when_no_provider_is_configured(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder()
    monkeypatch.setattr(outbox, "_deliver", recorder)
    row_id = add_row()

    settings = make_settings(ai_url, email_api_key=None, email_from=None, telegram_bot_token=None)
    assert run_worker(settings) == (0, 0)
    assert recorder.delivered == []
    assert state(row_id)["attempts"] == 0


def test_unsupported_template_fails_with_a_clear_reason(ai_url, clean) -> None:
    # Not patched: the real delivery code refuses before any network call.
    row_id = add_row(template="unknown_template")

    assert run_worker(make_settings(ai_url)) == (0, 1)

    row = state(row_id)
    assert row["status"] == "pending"
    assert row["last_error"] == "Unsupported notification template: unknown_template"


# --------------------------------------------------------------------- locks
def test_stale_locks_are_taken_over_and_fresh_locks_respected(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder()
    monkeypatch.setattr(outbox, "_deliver", recorder)
    stale_id = add_row(locked_seconds_ago=1800)   # older than the 900 second timeout
    fresh_id = add_row(locked_seconds_ago=60)     # another run is still working on it

    assert run_worker(make_settings(ai_url)) == (1, 0)

    assert recorder.delivered == [stale_id]
    assert state(stale_id)["status"] == "sent"
    untouched = state(fresh_id)
    assert untouched["status"] == "pending"
    assert untouched["locked_by"] == "dead-worker"
    assert untouched["attempts"] == 0


def test_two_runs_at_once_never_send_the_same_row(monkeypatch, ai_url, clean) -> None:
    recorder = Recorder(delay=0.2)
    monkeypatch.setattr(outbox, "_deliver", recorder)
    ids = [add_row() for _ in range(6)]
    settings = make_settings(ai_url, outbox_batch_size=3)

    async def both() -> list[tuple[int, int]]:
        return list(await asyncio.gather(
            outbox.process_outbox(settings),
            outbox.process_outbox(settings),
        ))

    results = asyncio.run(both())

    assert sum(sent for sent, _ in results) == 6
    assert sorted(recorder.delivered) == sorted(ids)      # each row exactly once
    assert len(set(recorder.delivered)) == 6
    assert all(state(row_id)["status"] == "sent" for row_id in ids)


# --------------------------------------------------------------- role limits
def test_worker_role_cannot_touch_protected_tables(ai_url, clean) -> None:
    async def attempt() -> None:
        connection = await asyncpg.connect(ai_url)
        try:
            await connection.fetch("select count(*) from public.notifications_outbox")
            for sql in (
                "select count(*) from public.clients",
                "select count(*) from public.projects",
                "select count(*) from public.payments",
                "select count(*) from public.internal_notes",
                "delete from public.notifications_outbox",
            ):
                with pytest.raises(asyncpg.InsufficientPrivilegeError):
                    await connection.fetch(sql)
        finally:
            await connection.close()

    asyncio.run(attempt())


# ------------------------------------------- real senders, fake HTTP (no DB)
def _send(sender, row: dict[str, Any], handler, settings: Settings) -> None:
    async def go() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await sender(client, row, settings)

    asyncio.run(go())


def test_email_request_goes_to_the_provider_with_escaped_html() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "email-1"})

    row = {
        "to_address": "staff@example.com",
        "payload": {"name": "Test Lead", "message": "<script>alert(1)</script>"},
    }
    _send(outbox._send_email, row, handler, make_settings("unused"))

    request = seen[0]
    body = __import__("json").loads(request.content)
    assert str(request.url) == "https://api.resend.com/emails"
    assert request.headers["authorization"] == "Bearer test-key"
    assert body["to"] == ["staff@example.com"]
    assert body["subject"] == "New website lead: Test Lead"
    assert "<script>" not in body["html"]
    assert "&lt;script&gt;" in body["html"]


def test_long_telegram_message_is_cut_before_sending() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"ok": True})

    row = {"to_address": "12345", "payload": {"name": "Test Lead", "message": "x" * 5000}}
    _send(outbox._send_telegram, row, handler, make_settings("unused"))

    body = __import__("json").loads(seen[0].content)
    assert str(seen[0].url) == "https://api.telegram.org/bottest-token/sendMessage"
    assert body["chat_id"] == "12345"
    assert len(body["text"]) <= outbox.TELEGRAM_MAX_CHARS


def test_telegram_refusal_is_reported() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": False})

    row = {"to_address": "12345", "payload": {"name": "Test Lead"}}
    with pytest.raises(RuntimeError, match="Telegram rejected the notification"):
        _send(outbox._send_telegram, row, handler, make_settings("unused"))
