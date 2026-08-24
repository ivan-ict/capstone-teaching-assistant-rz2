from uuid import UUID

from pydantic import BaseModel, Field

from app.common.db_models import MessageRole, MessageStatus


class MessageCreateDTO(BaseModel):
    content: str = Field(min_length=1)
    file_ids: list[UUID] = Field(default_factory=list)


class MessageDTO(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    status: MessageStatus
    sequence_no: int


class MessageCreateResponseDTO(BaseModel):
    user_message: MessageDTO
    assistant_message: MessageDTO
    stream_url: str


class MessageRetryResponseDTO(BaseModel):
    message: MessageDTO
    stream_url: str


class RetrievedChunkDTO(BaseModel):
    file_id: UUID
    original_filename: str
    content: str
