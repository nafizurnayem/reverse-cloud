import pytest

from services.ai.scripts import reindex_knowledge


class Connection:
    def __init__(self) -> None:
        self.updates = []

    async def fetch(self, _query):
        return [{"id": 1, "content": "first"}, {"id": 2, "content": "second"}]

    async def executemany(self, _query, values):
        self.updates.extend(values)


class Embedder:
    async def embed_batch(self, texts):
        assert texts == ["first", "second"]
        return [[0.1, 0.2], [0.3, 0.4]]


@pytest.mark.asyncio
async def test_reindexes_existing_chunks_without_creating_documents(monkeypatch) -> None:
    connection = Connection()
    monkeypatch.setattr(reindex_knowledge, "configured_embedder", lambda: Embedder())

    assert await reindex_knowledge.reindex_knowledge(connection) == 2
    assert connection.updates == [(1, "[0.1,0.2]"), (2, "[0.3,0.4]")]
