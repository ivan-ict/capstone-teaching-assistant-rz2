import asyncio
import logging
import mimetypes
import re
from io import BytesIO
from typing import Protocol
from uuid import UUID, uuid4

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from fastapi import status
from pypdf import PdfReader
from sqlalchemy.exc import SQLAlchemyError

from app.common.ai import (
    EmbeddingProvider,
    ImageDescriptionProvider,
    OllamaEmbeddingProvider,
    OllamaImageDescriptionProvider,
)
from app.common.config import Settings, get_settings
from app.common.db_models import File, FileProcessingStatus
from app.common.errors import ApiError, ErrorDetailDTO, NotFoundError
from app.common.object_storage import ObjectStorageClient
from app.common.text_processing import chunk_text
from app.modules.files.file_model import (
    FileBulkDeleteResultDTO,
    FileContentDTO,
    FileDetailDTO,
    FileDTO,
    FileListDTO,
)
from app.modules.files.file_repository import FileRepository

STORED_FILENAME_MAX_LENGTH = 255
FILE_METADATA_MAX_LENGTH = 255
GENERIC_MIME_TYPES = {"", "application/octet-stream"}
DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
SUPPORTED_BINARY_TYPES = {
    ".pdf": ("pdf", "application/pdf"),
    ".docx": ("docx", DOCX_MIME_TYPE),
    ".jpg": ("image", "image/jpeg"),
    ".jpeg": ("image", "image/jpeg"),
    ".png": ("image", "image/png"),
    ".webp": ("image", "image/webp"),
}

logger = logging.getLogger(__name__)


class StorageProvider(Protocol):
    def upload_bytes(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
        metadata: dict[str, str] | None = None,
    ) -> None: ...

    def delete_object(self, storage_path: str) -> None: ...

    def download_bytes(self, storage_path: str) -> bytes: ...

    def presigned_download_url(self, storage_path: str, expires_in_seconds: int = 3600) -> str: ...


class FileService:
    def __init__(
        self,
        session,
        repository: FileRepository | None = None,
        storage: StorageProvider | None = None,
        embeddings: EmbeddingProvider | None = None,
        image_descriptions: ImageDescriptionProvider | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.repository = repository or FileRepository(session)
        self.storage = storage or ObjectStorageClient(self.settings)
        self.embeddings = embeddings or OllamaEmbeddingProvider(self.settings)
        self.image_descriptions = image_descriptions or OllamaImageDescriptionProvider(
            self.settings
        )

    async def upload_file(
        self,
        supervisor_id: UUID,
        original_filename: str,
        content: bytes,
        mime_type: str | None,
    ) -> FileDTO:
        inferred_mime_type = (
            mime_type or mimetypes.guess_type(original_filename)[0] or "application/octet-stream"
        )
        self._validate_upload_metadata(original_filename, inferred_mime_type)
        self._validate_upload_size(content)
        file_kind, inferred_mime_type = self._resolve_upload_type(
            original_filename, inferred_mime_type
        )
        chunks = None
        if file_kind != "image":
            if file_kind in {"pdf", "docx"}:
                text = await asyncio.to_thread(self._extract_text, file_kind, content)
            else:
                text = self._extract_text(file_kind, content)
            chunks = chunk_text(text, self.settings.chunk_size, self.settings.chunk_overlap)
            if not chunks:
                raise ApiError(
                    "INVALID_FILE_CONTENT",
                    "Uploaded files must contain extractable text.",
                )

        file_id = uuid4()
        stored_filename = self._stored_filename(file_id, original_filename)
        storage_path = f"supervisors/{supervisor_id}/files/{file_id}/{stored_filename}"
        storage_base_url = (
            f"{self.settings.rustfs_endpoint_url.rstrip('/')}/{self.settings.rustfs_bucket_name}/"
        )

        try:
            await asyncio.to_thread(
                self.storage.upload_bytes,
                storage_path,
                content,
                inferred_mime_type,
                {"original_filename": original_filename},
            )
        except Exception as exc:
            raise ApiError(
                "OBJECT_STORAGE_UPLOAD_FAILED",
                "Object storage upload failed.",
                status.HTTP_502_BAD_GATEWAY,
            ) from exc
        try:
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
            await self.session.commit()
        except SQLAlchemyError as exc:
            await self.session.rollback()
            try:
                await asyncio.to_thread(self.storage.delete_object, storage_path)
            except Exception as cleanup_exc:
                raise ApiError(
                    "OBJECT_STORAGE_CLEANUP_FAILED",
                    "Object storage cleanup failed after database write failure.",
                    status.HTTP_502_BAD_GATEWAY,
                ) from cleanup_exc
            raise ApiError(
                "DATABASE_WRITE_FAILED",
                "File metadata could not be persisted.",
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc
        processing_error = "File indexing failed."
        try:
            if file_kind == "image":
                processing_error = "Image description failed."
                text = await self.image_descriptions.describe_image(content, inferred_mime_type)
                chunks = chunk_text(text, self.settings.chunk_size, self.settings.chunk_overlap)
                if not chunks:
                    raise ApiError(
                        "INVALID_FILE_CONTENT",
                        "The image model returned no description.",
                    )
            processing_error = "File indexing failed."
            if chunks is None:
                raise ApiError("INVALID_FILE_CONTENT", "Document processing produced no chunks.")
            embeddings = await self.embeddings.embed_documents(chunks)
            self._validate_embeddings(embeddings, len(chunks))
            await self.repository.add_chunks(file.id, chunks, embeddings)
            file = await self.repository.set_processing_result(file, FileProcessingStatus.READY)
            await self.session.commit()
        except Exception as exc:
            logger.exception("File processing failed during upload stage: %s", processing_error)
            file = await self._mark_processing_failed(
                file_id,
                supervisor_id,
                processing_error,
            )
            raise ApiError(
                "DOCUMENT_PROCESSING_FAILED",
                "Document processing failed.",
                status.HTTP_502_BAD_GATEWAY,
            ) from exc

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
        await self.repository.delete(file)
        try:
            await asyncio.to_thread(self.storage.delete_object, file.storage_path)
        except Exception as exc:
            await self.session.rollback()
            raise ApiError(
                "OBJECT_STORAGE_DELETE_FAILED",
                "Object storage delete failed.",
                status.HTTP_502_BAD_GATEWAY,
            ) from exc
        await self.session.commit()

    async def bulk_delete_files(
        self, supervisor_id: UUID, file_ids: list[UUID]
    ) -> FileBulkDeleteResultDTO:
        deleted_ids: list[UUID] = []
        failed_ids: list[UUID] = []
        for file_id in list(dict.fromkeys(file_ids)):
            try:
                await self.delete_file(supervisor_id, file_id)
                deleted_ids.append(file_id)
            except Exception:
                failed_ids.append(file_id)
        return FileBulkDeleteResultDTO(deleted_ids=deleted_ids, failed_ids=failed_ids)

    async def get_content(self, supervisor_id: UUID, file_id: UUID) -> FileContentDTO:
        file = await self._get_file(supervisor_id, file_id)
        if not self._is_supported_text_file(file.original_filename, file.mime_type):
            raise ApiError(
                "UNSUPPORTED_FILE_TYPE",
                "Only UTF-8 text files can be previewed.",
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        try:
            content = await asyncio.to_thread(self.storage.download_bytes, file.storage_path)
        except Exception as exc:
            raise ApiError(
                "OBJECT_STORAGE_DOWNLOAD_FAILED",
                "Object storage download failed.",
                status.HTTP_502_BAD_GATEWAY,
            ) from exc
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ApiError(
                "INVALID_FILE_CONTENT",
                "Stored file content is not valid UTF-8.",
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            ) from exc
        return FileContentDTO(
            id=file.id,
            original_filename=file.original_filename,
            mime_type=file.mime_type,
            content=text,
        )

    async def download_file(self, supervisor_id: UUID, file_id: UUID) -> tuple[File, bytes]:
        file = await self._get_file(supervisor_id, file_id)
        try:
            content = await asyncio.to_thread(self.storage.download_bytes, file.storage_path)
        except Exception as exc:
            raise ApiError(
                "OBJECT_STORAGE_DOWNLOAD_FAILED",
                "Object storage download failed.",
                status.HTTP_502_BAD_GATEWAY,
            ) from exc
        return file, content

    async def _get_file(self, supervisor_id: UUID, file_id: UUID) -> File:
        file = await self.repository.get_for_supervisor(file_id, supervisor_id)
        if file is None:
            raise NotFoundError("File not found.")
        return file

    def _is_supported_text_file(self, original_filename: str, mime_type: str) -> bool:
        return mime_type.startswith("text/") or original_filename.lower().endswith((".txt", ".md"))

    def _resolve_upload_type(self, original_filename: str, mime_type: str) -> tuple[str, str]:
        extension = f".{original_filename.rsplit('.', 1)[-1].lower()}"
        binary_type = SUPPORTED_BINARY_TYPES.get(extension)
        if binary_type is not None:
            file_kind, canonical_mime_type = binary_type
            if mime_type not in GENERIC_MIME_TYPES and mime_type != canonical_mime_type:
                raise ApiError(
                    "UNSUPPORTED_FILE_TYPE",
                    "The filename extension and content type do not match.",
                )
            return file_kind, canonical_mime_type

        if mime_type.startswith("text/"):
            return "text", mime_type
        if extension == ".txt" and mime_type in GENERIC_MIME_TYPES:
            return "text", "text/plain"
        if extension == ".md" and mime_type in GENERIC_MIME_TYPES:
            return "text", "text/markdown"
        raise ApiError(
            "UNSUPPORTED_FILE_TYPE",
            "Supported uploads are text, Markdown, PDF, DOCX, JPEG, PNG, and WebP files.",
        )

    def _extract_text(self, file_kind: str, content: bytes) -> str:
        if file_kind == "text":
            try:
                return content.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise ApiError(
                    "INVALID_FILE_CONTENT",
                    "Uploaded text files must use UTF-8.",
                ) from exc

        try:
            if file_kind == "pdf":
                reader = PdfReader(BytesIO(content))
                if reader.is_encrypted:
                    raise ValueError("Encrypted PDFs are not supported.")
                return "\n\n".join(page.extract_text() or "" for page in reader.pages)
            if file_kind == "docx":
                document = Document(BytesIO(content))
                blocks: list[str] = []
                for block in document.iter_inner_content():
                    if isinstance(block, Paragraph):
                        blocks.append(block.text)
                    elif isinstance(block, Table):
                        blocks.append(
                            "\n".join(
                                "\t".join(cell.text.strip() for cell in row.cells)
                                for row in block.rows
                            )
                        )
                return "\n".join(blocks)
        except Exception as exc:
            raise ApiError(
                "INVALID_FILE_CONTENT",
                "The uploaded document could not be read.",
            ) from exc
        raise ApiError("UNSUPPORTED_FILE_TYPE", "The uploaded file type is not supported.")

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

    def _validate_upload_size(self, content: bytes) -> None:
        if len(content) > self.settings.max_upload_bytes:
            raise ApiError(
                "FILE_TOO_LARGE",
                f"Upload must be {self.settings.max_upload_bytes} bytes or fewer.",
                status.HTTP_413_CONTENT_TOO_LARGE,
            )

    def _validate_embeddings(self, embeddings: list[list[float]], expected_count: int) -> None:
        if len(embeddings) != expected_count:
            raise ApiError("INVALID_EMBEDDING", "Embedding count does not match chunk count.")
        if any(len(embedding) != self.settings.embedding_dimension for embedding in embeddings):
            raise ApiError("INVALID_EMBEDDING", "Embedding dimension does not match settings.")

    async def _mark_processing_failed(
        self,
        file_id: UUID,
        supervisor_id: UUID,
        processing_error: str,
    ) -> File:
        await self.session.rollback()
        try:
            file = await self.repository.get_for_supervisor(file_id, supervisor_id)
            if file is None:
                raise ApiError(
                    "DATABASE_WRITE_FAILED",
                    "File processing status could not be persisted.",
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            file = await self.repository.set_processing_result(
                file,
                FileProcessingStatus.FAILED,
                processing_error,
            )
            await self.session.commit()
            return file
        except ApiError:
            raise
        except SQLAlchemyError as exc:
            await self.session.rollback()
            raise ApiError(
                "DATABASE_WRITE_FAILED",
                "File processing status could not be persisted.",
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc

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
