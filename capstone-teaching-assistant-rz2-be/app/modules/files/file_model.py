from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import FileProcessingStatus


class FileDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    mime_type: str
    file_size_bytes: int
    processing_status: FileProcessingStatus
    processing_error: str | None = None
    created_at: datetime


class FileDetailDTO(FileDTO):
    updated_at: datetime


class FileListDTO(BaseModel):
    items: list[FileDTO]
    page: int
    page_size: int
    total: int


class FileUploadDTO(BaseModel):
    original_filename: str = Field(min_length=1, max_length=255)
    mime_type: str
    content: bytes


class FileContentDTO(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    content: str


class FileBulkDeleteDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_ids: list[UUID] = Field(min_length=1, max_length=100)


class FileBulkDeleteResultDTO(BaseModel):
    deleted_ids: list[UUID]
    failed_ids: list[UUID]
