from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import FileProcessingStatus, MessageRole, MessageStatus
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT
from app.modules.messages.message_model import MessageSourceDTO


class ProjectSummaryDTO(BaseModel):
    id: UUID
    name: str


class ConversationCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

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
    page: int = 1
    page_size: int | None = None
    total: int | None = None


class ConversationDetailDTO(BaseModel):
    id: UUID
    project: ProjectSummaryDTO | None
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationRenameDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)


class ConversationRenameResponseDTO(BaseModel):
    id: UUID
    title: str
    updated_at: datetime


class ConversationMoveProjectDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID | None


class ConversationMoveProjectResponseDTO(BaseModel):
    id: UUID
    project_id: UUID | None
    updated_at: datetime


class MessageFileDTO(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str | None = None
    file_size_bytes: int
    created_at: datetime


class ConversationMessageDTO(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    status: MessageStatus
    sequence_no: int
    files: list[MessageFileDTO]
    sources: list[MessageSourceDTO] = Field(default_factory=list)
    created_at: datetime


class ConversationMessageListDTO(BaseModel):
    items: list[ConversationMessageDTO]


class ConversationFileDTO(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    file_size_bytes: int
    processing_status: FileProcessingStatus
    created_at: datetime


class ConversationFileListDTO(BaseModel):
    items: list[ConversationFileDTO]


class ConversationFileAssociateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_ids: list[UUID] = Field(min_length=1, max_length=MAX_FILE_IDS_PER_CHAT_CONTEXT)


class ConversationFileSummaryDTO(BaseModel):
    id: UUID
    original_filename: str


class ConversationFileAssociationDTO(BaseModel):
    conversation_id: UUID
    files: list[ConversationFileSummaryDTO]
