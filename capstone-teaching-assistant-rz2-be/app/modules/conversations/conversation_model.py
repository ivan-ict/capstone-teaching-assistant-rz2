from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import MessageRole, MessageStatus
from app.modules.messages.message_model import MessageSourceDTO


class ConversationCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConversationDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    semester_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationListDTO(BaseModel):
    items: list[ConversationDTO]
    page: int
    page_size: int
    total: int


class ConversationRenameDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=255)


class ConversationMessageDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    role: MessageRole
    content: str
    status: MessageStatus
    sequence_no: int
    sources: list[MessageSourceDTO] = Field(default_factory=list)
    created_at: datetime


class ConversationMessageListDTO(BaseModel):
    items: list[ConversationMessageDTO]
