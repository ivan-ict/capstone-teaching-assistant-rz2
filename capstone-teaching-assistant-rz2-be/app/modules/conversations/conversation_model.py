from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import FileProcessingStatus, MessageRole, MessageStatus


class ProjectSummaryDTO(BaseModel):
    id: UUID
    name: str


class ConversationCreateDTO(BaseModel):
    project_id: UUID | None = None


class ConversationDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID | None
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationListDTO(BaseModel):
    items: list[ConversationDTO]


class ConversationDetailDTO(BaseModel):
    id: UUID
    project: ProjectSummaryDTO | None
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationRenameDTO(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ConversationRenameResponseDTO(BaseModel):
    id: UUID
    title: str
    updated_at: datetime


class ConversationMoveProjectDTO(BaseModel):
    project_id: UUID | None = None


class ConversationMoveProjectResponseDTO(BaseModel):
    id: UUID
    project_id: UUID | None
    updated_at: datetime


class MessageFileDTO(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str | None = None


class ConversationMessageDTO(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    status: MessageStatus
    sequence_no: int
    files: list[MessageFileDTO]
    created_at: datetime


class ConversationMessageListDTO(BaseModel):
    items: list[ConversationMessageDTO]


class ConversationFileDTO(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    file_size_bytes: int
    processing_status: FileProcessingStatus


class ConversationFileListDTO(BaseModel):
    items: list[ConversationFileDTO]


class ConversationFileAssociateDTO(BaseModel):
    file_ids: list[UUID] = Field(min_length=1)


class ConversationFileSummaryDTO(BaseModel):
    id: UUID
    original_filename: str


class ConversationFileAssociationDTO(BaseModel):
    conversation_id: UUID
    files: list[ConversationFileSummaryDTO]
