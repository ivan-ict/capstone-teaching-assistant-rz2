from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.common.db_models import AccountStatus, TeachingSemester
from app.common.security import MAX_PASSWORD_LENGTH

SupervisorName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
SupervisorPhone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=32)]


class SupervisorCreateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: SupervisorName
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)
    first_name: SupervisorName
    last_name: SupervisorName
    email: EmailStr = Field(max_length=320)
    phone: SupervisorPhone | None = None
    faculty_id: UUID
    teaching_year: int | None = Field(default=None, ge=2000, le=2100)
    teaching_semester: TeachingSemester | None = None

    @field_validator("phone")
    @classmethod
    def blank_phone_is_none(cls, value: str | None) -> str | None:
        return None if value == "" else value


class SupervisorProfileDTO(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str
    phone: str | None = None
    faculty_id: UUID
    teaching_year: int | None = None
    teaching_semester: TeachingSemester | None = None


class SupervisorCreateResponseDTO(BaseModel):
    id: UUID
    username: str
    status: AccountStatus
    profile: SupervisorProfileDTO


class SupervisorFacultySummaryDTO(BaseModel):
    id: UUID
    name: str


class SupervisorListItemDTO(BaseModel):
    id: UUID
    username: str
    first_name: str
    last_name: str
    email: str
    status: AccountStatus
    faculty: SupervisorFacultySummaryDTO


class SupervisorListDTO(BaseModel):
    items: list[SupervisorListItemDTO]
    page: int
    page_size: int
    total: int


class SupervisorDetailDTO(BaseModel):
    id: UUID
    username: str
    status: AccountStatus
    profile: SupervisorProfileDTO


class SupervisorUpdateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = Field(default=None, max_length=320)
    phone: SupervisorPhone | None = None
    faculty_id: UUID | None = None
    teaching_year: int | None = Field(default=None, ge=2000, le=2100)
    teaching_semester: TeachingSemester | None = None

    @field_validator("phone")
    @classmethod
    def blank_phone_is_none(cls, value: str | None) -> str | None:
        return None if value == "" else value

    @model_validator(mode="after")
    def reject_required_nulls(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided.")
        if "email" in self.model_fields_set and self.email is None:
            raise ValueError("email cannot be null.")
        if "faculty_id" in self.model_fields_set and self.faculty_id is None:
            raise ValueError("faculty_id cannot be null.")
        return self


class SupervisorUpdateResponseDTO(BaseModel):
    id: UUID
    profile: SupervisorProfileDTO


class SupervisorStatusUpdateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: AccountStatus


class SupervisorStatusResponseDTO(BaseModel):
    id: UUID
    status: AccountStatus
