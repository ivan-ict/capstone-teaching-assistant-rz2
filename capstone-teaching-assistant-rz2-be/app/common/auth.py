from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.database import get_db_session
from app.common.db_models import AccountStatus, RevokedToken, User, UserRole
from app.common.errors import ApiError
from app.common.security import decode_access_token, token_digest

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    username: str
    role: UserRole
    status: AccountStatus


async def get_current_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> str:
    if credentials is None:
        raise _unauthorized()
    return credentials.credentials


async def get_current_user(
    access_token: Annotated[str, Depends(get_current_access_token)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CurrentUser:
    user_id = decode_access_token(access_token)
    if user_id is None:
        raise _unauthorized()
    if await _is_token_revoked(session, access_token):
        raise _unauthorized()
    user = await session.get(User, user_id)
    if user is None or user.deleted_at is not None or user.status != AccountStatus.ACTIVE:
        raise _unauthorized()
    return CurrentUser(
        id=user.id,
        username=user.username,
        role=user.role,
        status=user.status,
    )


async def get_current_admin(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if current_user.role != UserRole.ADMIN:
        raise ApiError("FORBIDDEN", "Admin access is required.", status.HTTP_403_FORBIDDEN)
    return current_user


async def get_current_supervisor(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if current_user.role != UserRole.SUPERVISOR:
        raise ApiError("FORBIDDEN", "Supervisor access is required.", status.HTTP_403_FORBIDDEN)
    return current_user


async def _is_token_revoked(session: AsyncSession, token: str) -> bool:
    query = select(RevokedToken.token_hash).where(
        RevokedToken.token_hash == token_digest(token),
        RevokedToken.expires_at > datetime.now(UTC),
    )
    return await session.scalar(query) is not None


def _unauthorized() -> ApiError:
    return ApiError(
        "UNAUTHENTICATED",
        "Authentication credentials were not provided or are invalid.",
        status.HTTP_401_UNAUTHORIZED,
    )
