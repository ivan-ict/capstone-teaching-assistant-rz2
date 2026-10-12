from datetime import date, datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.db_models import AccountStatus


class SemesterWriteDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=255)
    year: int = Field(ge=2000, le=2100)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def valid_dates(self) -> Self:
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must not precede start date.")
        return self


class SemesterSummaryDTO(SemesterWriteDTO):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    deleted_at: datetime | None


class SemesterDTO(SemesterSummaryDTO):
    created_at: datetime
    updated_at: datetime
    file_count: int = 0
    supervisor_count: int = 0
    ready_file_count: int = 0


class SemesterListDTO(BaseModel):
    items: list[SemesterDTO]
    total: int
    page: int
    page_size: int


class SemesterAssignDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")
    supervisor_ids: list[UUID] = Field(min_length=1, max_length=100)


class SemesterSupervisorDTO(BaseModel):
    id: UUID
    username: str
    first_name: str
    last_name: str
    status: AccountStatus
    semester: SemesterSummaryDTO


class SemesterSupervisorListDTO(BaseModel):
    items: list[SemesterSupervisorDTO]
    total: int
    page: int
    page_size: int
