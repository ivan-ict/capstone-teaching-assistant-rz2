from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.common.db_models import AccountStatus, TeachingSemester, UserRole
from app.common.security import MAX_PASSWORD_LENGTH


class AccountFacultyDTO(BaseModel):
    id: UUID
    code: str
    name: str


class AccountProfileDTO(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str | None
    faculty: AccountFacultyDTO
    teaching_year: int | None
    teaching_semester: TeachingSemester | None


class AccountDTO(BaseModel):
    id: UUID
    username: str
    role: UserRole
    status: AccountStatus
    profile: AccountProfileDTO | None = None


class PasswordChangeDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)
    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)


class PasswordChangeResponseDTO(BaseModel):
    message: str
