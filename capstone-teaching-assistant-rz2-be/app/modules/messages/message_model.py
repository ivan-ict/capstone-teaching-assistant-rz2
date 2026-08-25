from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import MessageRole, MessageStatus
from app.common.limits import MAX_FILE_IDS_PER_CHAT_CONTEXT, MAX_MESSAGE_CONTENT_LENGTH


class MessageCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CONTENT_LENGTH)
    file_ids: list[UUID] = Field(default_factory=list, max_length=MAX_FILE_IDS_PER_CHAT_CONTEXT)


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
