from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import Settings
from app.common.db_models import DocumentChunk, File, FileProcessingStatus
from app.common.errors import ApiError
from app.modules.files.file_service import FileService
from tests.conftest import DEV_SUPERVISOR_ID


class FakeStorage:
    def __init__(self) -> None:
        self.uploaded_paths: list[str] = []

    def upload_bytes(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> None:
        self.uploaded_paths.append(storage_path)

    def delete_object(self, storage_path: str) -> None:
        return None

    def presigned_download_url(self, storage_path: str, expires_in_seconds: int = 3600) -> str:
        return f"http://storage.local/{storage_path}?expires={expires_in_seconds}"


class FakeEmbeddings:
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(index), 0.1, 0.2] for index, _text in enumerate(texts)]

    async def embed_query(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


@pytest.mark.asyncio
async def test_upload_text_file_stores_file_and_chunks(session: AsyncSession) -> None:
    storage = FakeStorage()
    settings = Settings(chunk_size=20, chunk_overlap=5)
    service = FileService(session, storage=storage, embeddings=FakeEmbeddings(), settings=settings)

    result = await service.upload_text_file(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename="notes.txt",
        content=b"Capstone teams need regular supervisor feedback.",
        mime_type="text/plain",
    )

    assert result.processing_status == FileProcessingStatus.READY
    assert result.file_size_bytes == len(b"Capstone teams need regular supervisor feedback.")
    assert len(storage.uploaded_paths) == 1

    chunks = list(
        await session.scalars(select(DocumentChunk).where(DocumentChunk.file_id == result.id))
    )
    assert len(chunks) > 1


@pytest.mark.asyncio
async def test_upload_rejects_non_text_file(session: AsyncSession) -> None:
    service = FileService(
        session,
        storage=FakeStorage(),
        embeddings=FakeEmbeddings(),
        settings=Settings(),
    )

    with pytest.raises(ApiError) as exc:
        await service.upload_text_file(
            supervisor_id=UUID("11111111-1111-1111-1111-111111111111"),
            original_filename="image.png",
            content=b"not text",
            mime_type="image/png",
        )

    assert exc.value.code == "UNSUPPORTED_FILE_TYPE"


@pytest.mark.asyncio
async def test_upload_text_file_caps_stored_filename_length(session: AsyncSession) -> None:
    service = FileService(
        session,
        storage=FakeStorage(),
        embeddings=FakeEmbeddings(),
        settings=Settings(),
    )
    long_filename = f"{'a' * 251}.txt"

    result = await service.upload_text_file(
        supervisor_id=DEV_SUPERVISOR_ID,
        original_filename=long_filename,
        content=b"Long filename content.",
        mime_type="text/plain",
    )

    file = await session.get(File, result.id)
    assert file is not None
    assert len(file.stored_filename) <= 255
    assert file.stored_filename.endswith(".txt")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("original_filename", "mime_type", "field"),
    [
        (f"{'a' * 256}.txt", "text/plain", "file.filename"),
        ("notes.txt", f"text/{'a' * 251}", "file.content_type"),
    ],
)
async def test_upload_rejects_overlong_metadata_before_storage_write(
    session: AsyncSession,
    original_filename: str,
    mime_type: str,
    field: str,
) -> None:
    storage = FakeStorage()
    service = FileService(
        session,
        storage=storage,
        embeddings=FakeEmbeddings(),
        settings=Settings(),
    )

    with pytest.raises(ApiError) as exc:
        await service.upload_text_file(
            supervisor_id=DEV_SUPERVISOR_ID,
            original_filename=original_filename,
            content=b"Valid text.",
            mime_type=mime_type,
        )

    assert exc.value.code == "VALIDATION_ERROR"
    assert exc.value.http_status == 422
    assert exc.value.details[0].field == field
    assert storage.uploaded_paths == []
