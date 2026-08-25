from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.common.db_models import FileProcessingStatus
from app.common.limits import MAX_PROJECT_INSTRUCTIONS_LENGTH


class ProjectCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    instructions: str | None = Field(default=None, max_length=MAX_PROJECT_INSTRUCTIONS_LENGTH)

    @field_validator("instructions")
    @classmethod
    def blank_instructions_are_none(cls, value: str | None) -> str | None:
        return None if value == "" else value


class ProjectDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    instructions: str | None
    created_at: datetime
    updated_at: datetime


class ProjectListItemDTO(BaseModel):
    id: UUID
    name: str
    instructions: str | None
    updated_at: datetime


class ProjectListDTO(BaseModel):
    items: list[ProjectListItemDTO]


class ProjectUpdateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    instructions: str | None = Field(default=None, max_length=MAX_PROJECT_INSTRUCTIONS_LENGTH)

    @field_validator("instructions")
    @classmethod
    def blank_instructions_are_none(cls, value: str | None) -> str | None:
        return None if value == "" else value

    @model_validator(mode="after")
    def reject_required_nulls(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided.")
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null.")
        return self


class ProjectUpdateResponseDTO(BaseModel):
    id: UUID
    name: str
    instructions: str | None


class ProjectFileDTO(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    file_size_bytes: int
    processing_status: FileProcessingStatus


class ProjectFileListDTO(BaseModel):
    items: list[ProjectFileDTO]
