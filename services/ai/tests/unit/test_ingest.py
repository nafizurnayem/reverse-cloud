import pytest

from services.ai.app.retrieval.ingest import ContentRecord, ingest_content_tables, split_content


class Repository:
    async def list_published_content(self):
        return [ContentRecord(id="one", title="Title", body="one two three")]


class VectorStore:
    def __init__(self):
        self.calls = []

    async def upsert_chunks(self, content_id, chunks):
        self.calls.append((content_id, list(chunks)))


def test_split_content_respects_chunk_size():
    assert split_content("alpha beta gamma", chunk_size=10, overlap=0) == ["alpha beta", "gamma"]


def test_split_content_preserves_overlap():
    assert split_content("one two three four", chunk_size=13, overlap=5) == ["one two three", "three four"]


@pytest.mark.asyncio
async def test_ingests_published_content_into_vector_store():
    store = VectorStore()

    assert await ingest_content_tables(Repository(), store) == 1
    assert store.calls == [("one", ["Title one two three"])]
