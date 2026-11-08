import pytest

from services.ai.scripts.ingest_knowledge import ingest_entries


class Connection:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple]] = []

    async def fetchrow(self, _query, *_args):
        return None

    async def execute(self, query, *args):
        self.executed.append((query, args))


@pytest.mark.asyncio
async def test_manual_ingestion_writes_current_document_schema():
    connection = Connection()
    result = await ingest_entries(
        connection,
        [{
            "title": "Public FAQ",
            "content": "Verified website content.",
            "source_type": "manual",
            "source_id": None,
            "visibility": "public",
            "locale": "en",
        }],
        generate_embeddings=False,
    )

    assert result == {
        "documents_inserted": 1,
        "documents_updated": 0,
        "documents_skipped": 0,
        "chunks_inserted": 1,
    }
    document_query, document_args = connection.executed[0]
    assert "content_hash" in document_query and "visibility" in document_query
    assert document_args[-1] == "public"


@pytest.mark.asyncio
async def test_source_backed_entries_require_source_id():
    with pytest.raises(ValueError, match="source_id is required"):
        await ingest_entries(
            Connection(),
            [{
                "title": "FAQ",
                "content": "Answer",
                "source_type": "faq",
                "source_id": None,
                "visibility": "public",
                "locale": "en",
            }],
            generate_embeddings=False,
        )
