from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FacultyDTO(BaseModel):
    id: UUID
    code: str
    name: str


class FacultyListDTO(BaseModel):
    items: list[FacultyDTO]


class AdminFacultyDTO(FacultyDTO):
    is_active: bool
    supervisor_count: int
    created_at: datetime
    updated_at: datetime


class AdminFacultyListDTO(BaseModel):
    items: list[AdminFacultyDTO]
    page: int
    page_size: int
    total: int


class FacultyCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)


class FacultyUpdateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    code: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
