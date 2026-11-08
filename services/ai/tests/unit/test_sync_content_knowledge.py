import pytest

from services.ai.scripts import sync_content_knowledge


class Connection:
    def __init__(self) -> None:
        self.deactivated: list[tuple[str, list]] = []

    async def fetch(self, _query):
        return [{
            "source_type": "faq",
            "source_id": "11111111-1111-4111-8111-111111111111",
            "title": "Question",
            "content": "Answer",
            "locale": "en",
        }]

    async def execute(self, _query, source_type, active_ids):
        self.deactivated.append((source_type, active_ids))


@pytest.mark.asyncio
async def test_syncs_public_rows_and_deactivates_unpublished_sources(monkeypatch):
    captured = []

    async def fake_ingest(_connection, entries, generate_embeddings):
        captured.extend(entries)
        assert generate_embeddings is True
        return {
            "documents_inserted": 1,
            "documents_updated": 0,
            "documents_skipped": 0,
            "chunks_inserted": 1,
        }

    monkeypatch.setattr(sync_content_knowledge, "ingest_entries", fake_ingest)
    connection = Connection()

    result = await sync_content_knowledge.sync_content(connection)

    assert result["documents_inserted"] == 1
    assert captured[0]["visibility"] == "public"
    assert connection.deactivated[1] == (
        "faq",
        ["11111111-1111-4111-8111-111111111111"],
    )
