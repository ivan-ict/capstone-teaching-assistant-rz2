from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import Settings
from app.common.db_models import DocumentChunk, File


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

    def download_bytes(self, storage_path: str) -> bytes:
        return b"Capstone handbook guidance for teams."

    def presigned_download_url(self, storage_path: str, expires_in_seconds: int = 3600) -> str:
        return f"http://storage.local/{storage_path}"


class FakeEmbeddings:
    def __init__(self, settings) -> None:
        self.settings = settings

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * self.settings.embedding_dimension for _text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1] * self.settings.embedding_dimension


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

    overlong_search_response = await client.get("/api/v1/files", params={"search": "a" * 101})
    assert overlong_search_response.status_code == 422
    assert overlong_search_response.json()["error"]["code"] == "VALIDATION_ERROR"

    detail_response = await client.get(f"/api/v1/files/{uploaded['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == uploaded["id"]

    download_response = await client.get(f"/api/v1/files/{uploaded['id']}", follow_redirects=False)
    assert download_response.status_code == 200

    redirect_response = await client.get(
        f"/api/v1/files/{uploaded['id']}/download", follow_redirects=False
    )
    assert redirect_response.status_code == 302
    assert redirect_response.headers["location"].startswith("http://storage.local/")

    delete_response = await client.delete(f"/api/v1/files/{uploaded['id']}")
    assert delete_response.status_code == 204

    deleted_chunks = list(
        await session.scalars(
            select(DocumentChunk).where(DocumentChunk.file_id == UUID(uploaded["id"]))
        )
    )
    assert all(chunk.deleted_at is not None for chunk in deleted_chunks)


@pytest.mark.asyncio
async def test_file_content_preview_and_bulk_delete(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.modules.files.file_service.ObjectStorageClient", FakeStorageClient)
    monkeypatch.setattr("app.modules.files.file_service.OllamaEmbeddingProvider", FakeEmbeddings)

    upload_response = await client.post(
        "/api/v1/files",
        files={"file": ("handbook.txt", b"Capstone handbook guidance for teams.", "text/plain")},
    )
    file_id = upload_response.json()["id"]

    content_response = await client.get(f"/api/v1/files/{file_id}/content")
    assert content_response.status_code == 200
    assert content_response.json()["content"] == "Capstone handbook guidance for teams."

    delete_response = await client.post("/api/v1/files/bulk-delete", json={"file_ids": [file_id]})
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_ids"] == [file_id]
    assert delete_response.json()["failed_ids"] == []


@pytest.mark.asyncio
async def test_openapi_documents_file_download_as_redirect(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    download_response = response.json()["paths"]["/api/v1/files/{file_id}/download"]["get"][
        "responses"
    ]["302"]
    assert download_response["content"] == {}


@pytest.mark.asyncio
async def test_file_upload_rejects_oversized_body_before_persisting(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.modules.files.file_router.get_settings",
        lambda: Settings(max_upload_bytes=4),
    )

    response = await client.post(
        "/api/v1/files",
        files={"file": ("too-large.txt", b"too large", "text/plain")},
    )

    files = list(await session.scalars(select(File)))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"
    assert files == []
