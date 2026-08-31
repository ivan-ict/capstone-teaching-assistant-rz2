from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import MessageRole, MessageStatus
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT, MAX_MESSAGE_CONTENT_LENGTH


class MessageCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    content: str = Field(default="", max_length=MAX_MESSAGE_CONTENT_LENGTH)
    file_ids: list[UUID] = Field(default_factory=list, max_length=MAX_FILE_IDS_PER_CHAT_CONTEXT)


class MessageSourceDTO(BaseModel):
    chunk_id: UUID | None = None
    file_id: UUID
    original_filename: str
    content: str


class MessageDTO(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    status: MessageStatus
    sequence_no: int
    sources: list[MessageSourceDTO] = Field(default_factory=list)


class MessageCreateResponseDTO(BaseModel):
    user_message: MessageDTO
    assistant_message: MessageDTO
    conversation_title: str
    stream_url: str


class MessageRetryResponseDTO(BaseModel):
    message: MessageDTO
    stream_url: str


class RetrievedChunkDTO(BaseModel):
    chunk_id: UUID
    file_id: UUID
    original_filename: str
    content: str
