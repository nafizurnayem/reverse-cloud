"""Unit tests for transcript review module (Phase 5, Wave 1)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.jobs.transcript_review import (
    MIN_RESPONSE_LENGTH,
    _fetch_flagged_responses,
    _fetch_locale_summary,
    generate_transcript_review,
)


@pytest.fixture
def since() -> datetime:
    return datetime(2026, 10, 1, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_fetch_locale_summary(since: datetime) -> None:
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[
            {
                "locale": "en",
                "user_messages": 50,
                "assistant_messages": 48,
                "avg_assistant_length": 250.5,
                "min_assistant_length": 30,
                "max_assistant_length": 1200,
            },
            {
                "locale": "bn",
                "user_messages": 20,
                "assistant_messages": 19,
                "avg_assistant_length": 180.0,
                "min_assistant_length": 25,
                "max_assistant_length": 900,
            },
        ]
    )

    result = await _fetch_locale_summary(mock_conn, since)
    assert len(result) == 2
    assert result[0]["locale"] == "en"
    assert result[0]["avg_assistant_length"] == 250.5
    assert result[1]["locale"] == "bn"
    mock_conn.fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_flagged_responses(since: datetime) -> None:
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        return_value=[
            {
                "conversation_id": "conv-001",
                "content": "Hi",
                "locale": "en",
                "created_at": datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc),
            }
        ]
    )

    result = await _fetch_flagged_responses(mock_conn, since)
    assert len(result) == 1
    assert result[0]["length"] == 2
    assert result[0]["conversation_id"] == "conv-001"


@pytest.mark.asyncio
async def test_generate_transcript_review_quality_scores(since: datetime) -> None:
    mock_conn = AsyncMock()

    # Locale summary
    mock_conn.fetch = AsyncMock(
        side_effect=[
            # _fetch_locale_summary call
            [
                {
                    "locale": "en",
                    "user_messages": 100,
                    "assistant_messages": 95,
                    "avg_assistant_length": 210.0,
                    "min_assistant_length": 40,
                    "max_assistant_length": 1500,
                },
                {
                    "locale": "bn",
                    "user_messages": 30,
                    "assistant_messages": 28,
                    "avg_assistant_length": 50.0,
                    "min_assistant_length": 5,
                    "max_assistant_length": 600,
                },
            ],
            # _fetch_flagged_responses call
            [],
            # _fetch_sample_exchanges call for "en"
            [],
            # _fetch_sample_exchanges call for "bn"
            [],
        ]
    )

    report = await generate_transcript_review(mock_conn, since=since)

    assert "locale_summary" in report
    assert "quality_assessment" in report
    assert report["quality_assessment"]["en"] == "good"
    assert report["quality_assessment"]["bn"] == "needs_review"
    assert report["total_flagged"] == 0


@pytest.mark.asyncio
async def test_generate_transcript_review_without_samples(since: datetime) -> None:
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(
        side_effect=[
            # locale summary
            [],
            # flagged responses
            [],
        ]
    )

    report = await generate_transcript_review(mock_conn, since=since, include_samples=False)
    assert "sample_exchanges" not in report
    assert report["total_flagged"] == 0
