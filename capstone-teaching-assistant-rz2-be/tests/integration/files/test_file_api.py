from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import DocumentChunk


class FakeStorageClient:
    def __init__(self, settings) -> None:
        self.settings = settings

    def upload_bytes(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> None:
        return None

    def delete_object(self, storage_path: str) -> None:
        return None

    def presigned_download_url(self, storage_path: str, expires_in_seconds: int = 3600) -> str:
        return f"http://storage.local/{storage_path}"


class FakeEmbeddings:
    def __init__(self, settings) -> None:
        self.settings = settings

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1, 0.2, 0.3] for _text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


@pytest.mark.asyncio
async def test_file_upload_list_detail_download_and_delete(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.modules.files.file_service.ObjectStorageClient", FakeStorageClient)
    monkeypatch.setattr("app.modules.files.file_service.OllamaEmbeddingProvider", FakeEmbeddings)

    upload_response = await client.post(
        "/api/v1/files",
        files={"file": ("handbook.txt", b"Capstone handbook guidance for teams.", "text/plain")},
    )

    assert upload_response.status_code == 201
    uploaded = upload_response.json()
    assert uploaded["original_filename"] == "handbook.txt"
    assert uploaded["processing_status"] == "READY"

    chunks = list(
        await session.scalars(
            select(DocumentChunk).where(DocumentChunk.file_id == UUID(uploaded["id"]))
        )
    )
    assert len(chunks) == 1

    list_response = await client.get("/api/v1/files")
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1

    detail_response = await client.get(f"/api/v1/files/{uploaded['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == uploaded["id"]

    download_response = await client.get(f"/api/v1/files/{uploaded['id']}", follow_redirects=False)
    assert download_response.status_code == 200

    redirect_response = await client.get(
        f"/api/v1/files/{uploaded['id']}/download", follow_redirects=False
    )
    assert redirect_response.status_code in {302, 307}
    assert redirect_response.headers["location"].startswith("http://storage.local/")

    delete_response = await client.delete(f"/api/v1/files/{uploaded['id']}")
    assert delete_response.status_code == 204
