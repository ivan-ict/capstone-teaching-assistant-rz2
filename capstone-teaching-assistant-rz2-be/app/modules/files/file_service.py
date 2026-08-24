import asyncio
import mimetypes
import re
from typing import Protocol
from uuid import UUID, uuid4

from fastapi import status

from app.common.ai import EmbeddingProvider, OllamaEmbeddingProvider
from app.common.config import Settings, get_settings
from app.common.db_models import File, FileProcessingStatus
from app.common.errors import ApiError, ErrorDetailDTO, NotFoundError
from app.common.object_storage import ObjectStorageClient
from app.common.text_processing import chunk_text
from app.modules.files.file_model import FileDetailDTO, FileDTO, FileListDTO
from app.modules.files.file_repository import FileRepository

STORED_FILENAME_MAX_LENGTH = 255
FILE_METADATA_MAX_LENGTH = 255


class StorageProvider(Protocol):
    def upload_bytes(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> None: ...

    def delete_object(self, storage_path: str) -> None: ...

    def presigned_download_url(self, storage_path: str, expires_in_seconds: int = 3600) -> str: ...


class FileService:
    def __init__(
        self,
        session,
        repository: FileRepository | None = None,
        storage: StorageProvider | None = None,
        embeddings: EmbeddingProvider | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.repository = repository or FileRepository(session)
        self.storage = storage or ObjectStorageClient(self.settings)
        self.embeddings = embeddings or OllamaEmbeddingProvider(self.settings)

    async def upload_text_file(
        self,
        supervisor_id: UUID,
        original_filename: str,
        content: bytes,
        mime_type: str | None,
    ) -> FileDTO:
        inferred_mime_type = mime_type or mimetypes.guess_type(original_filename)[0] or "text/plain"
        self._validate_upload_metadata(original_filename, inferred_mime_type)
        if not self._is_supported_text_file(original_filename, inferred_mime_type):
            raise ApiError("UNSUPPORTED_FILE_TYPE", "Only text file uploads are supported.")
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ApiError("INVALID_FILE_CONTENT", "Uploaded text files must use UTF-8.") from exc

        chunks = chunk_text(text, self.settings.chunk_size, self.settings.chunk_overlap)
        if not chunks:
            raise ApiError("INVALID_FILE_CONTENT", "Uploaded text files must not be empty.")

        file_id = uuid4()
        stored_filename = self._stored_filename(file_id, original_filename)
        storage_path = f"supervisors/{supervisor_id}/files/{file_id}/{stored_filename}"
        storage_base_url = (
            f"{self.settings.rustfs_endpoint_url.rstrip('/')}/{self.settings.rustfs_bucket_name}/"
        )

        await asyncio.to_thread(
            self.storage.upload_bytes,
            storage_path,
            content,
            inferred_mime_type,
            {"original_filename": original_filename},
        )
        file = await self.repository.create(
            file_id=file_id,
            supervisor_id=supervisor_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            storage_base_url=storage_base_url,
            storage_path=storage_path,
            mime_type=inferred_mime_type,
            file_size_bytes=len(content),
        )
        try:
            embeddings = await self.embeddings.embed_documents(chunks)
            await self.repository.add_chunks(file.id, chunks, embeddings)
            file = await self.repository.set_processing_result(file, FileProcessingStatus.READY)
        except Exception as exc:
            file = await self.repository.set_processing_result(
                file,
                FileProcessingStatus.FAILED,
                "Document processing failed.",
            )
            await self.session.commit()
            raise ApiError("DOCUMENT_PROCESSING_FAILED", "Document processing failed.") from exc

        await self.session.commit()
        return FileDTO.model_validate(file)

    async def list_files(
        self,
        supervisor_id: UUID,
        search: str | None,
        processing_status: FileProcessingStatus | None,
        page: int,
        page_size: int,
    ) -> FileListDTO:
        files, total = await self.repository.list_for_supervisor(
            supervisor_id, search, processing_status, page, page_size
        )
        return FileListDTO(
            items=[FileDTO.model_validate(file) for file in files],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_file(self, supervisor_id: UUID, file_id: UUID) -> FileDetailDTO:
        file = await self._get_file(supervisor_id, file_id)
        return FileDetailDTO.model_validate(file)

    async def delete_file(self, supervisor_id: UUID, file_id: UUID) -> None:
        file = await self._get_file(supervisor_id, file_id)
        await asyncio.to_thread(self.storage.delete_object, file.storage_path)
        await self.repository.delete(file)
        await self.session.commit()

    async def get_download_url(self, supervisor_id: UUID, file_id: UUID) -> str:
        file = await self._get_file(supervisor_id, file_id)
        return await asyncio.to_thread(self.storage.presigned_download_url, file.storage_path)

    async def _get_file(self, supervisor_id: UUID, file_id: UUID) -> File:
        file = await self.repository.get_for_supervisor(file_id, supervisor_id)
        if file is None:
            raise NotFoundError("File not found.")
        return file

    def _is_supported_text_file(self, original_filename: str, mime_type: str) -> bool:
        return mime_type.startswith("text/") or original_filename.lower().endswith(".txt")

    def _validate_upload_metadata(self, original_filename: str, mime_type: str) -> None:
        details: list[ErrorDetailDTO] = []
        if len(original_filename) > FILE_METADATA_MAX_LENGTH:
            details.append(
                ErrorDetailDTO(
                    field="file.filename",
                    message="Filename must be 255 characters or fewer.",
                )
            )
        if len(mime_type) > FILE_METADATA_MAX_LENGTH:
            details.append(
                ErrorDetailDTO(
                    field="file.content_type",
                    message="Content type must be 255 characters or fewer.",
                )
            )
        if details:
            raise ApiError(
                "VALIDATION_ERROR",
                "Upload metadata validation failed.",
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                details,
            )

    def _safe_filename(self, original_filename: str) -> str:
        safe_filename = re.sub(r"[^A-Za-z0-9._-]+", "-", original_filename).strip(".-")
        return safe_filename or "upload.txt"

    def _stored_filename(self, file_id: UUID, original_filename: str) -> str:
        safe_filename = self._safe_filename(original_filename)
        max_safe_length = STORED_FILENAME_MAX_LENGTH - len(str(file_id)) - 1
        if len(safe_filename) <= max_safe_length:
            return f"{file_id}-{safe_filename}"

        stem, separator, suffix = safe_filename.rpartition(".")
        if separator and len(suffix) + 1 < max_safe_length:
            max_stem_length = max_safe_length - len(suffix) - 1
            truncated_stem = stem[:max_stem_length].rstrip(".-") or "upload"
            safe_filename = f"{truncated_stem}.{suffix}"
        else:
            safe_filename = safe_filename[:max_safe_length].rstrip(".-") or "upload"
        return f"{file_id}-{safe_filename}"
