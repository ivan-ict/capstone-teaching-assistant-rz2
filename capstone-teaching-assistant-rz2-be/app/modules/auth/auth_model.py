from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.common.db_models import AccountStatus, UserRole
from app.common.security import MAX_PASSWORD_LENGTH

Username = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=100)
]


class LoginRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Username
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class LoginResponseDTO(BaseModel):
    id: UUID
    username: str
    role: UserRole
    status: AccountStatus
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequestDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identifier: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=320)
    ]


class ForgotPasswordResponseDTO(BaseModel):
    message: str
