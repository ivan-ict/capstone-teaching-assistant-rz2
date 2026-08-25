from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus
from app.common.errors import ApiError
from app.common.security import (
    create_access_token,
    decode_access_token_claims,
    token_digest,
    verify_password,
)
from app.modules.auth.auth_model import LoginResponseDTO
from app.modules.auth.auth_repository import AuthRepository


class AuthService:
    def __init__(self, session: AsyncSession, repository: AuthRepository | None = None) -> None:
        self.session = session
        self.repository = repository or AuthRepository(session)

    async def login(self, username: str, password: str) -> LoginResponseDTO:
        user = await self.repository.get_user_by_username(username)
        if (
            user is None
            or user.status != AccountStatus.ACTIVE
            or not verify_password(password, user.password_hash)
        ):
            raise ApiError(
                "INVALID_CREDENTIALS",
                "Invalid username or password.",
                status.HTTP_401_UNAUTHORIZED,
            )
        await self.repository.purge_expired_revoked_tokens()
        await self.session.commit()
        return LoginResponseDTO(
            id=user.id,
            username=user.username,
            role=user.role,
            status=user.status,
            access_token=create_access_token(user.id),
        )

    async def logout(self, token: str) -> None:
        claims = decode_access_token_claims(token)
        if claims is None:
            raise ApiError(
                "UNAUTHENTICATED",
                "Authentication credentials were not provided or are invalid.",
                status.HTTP_401_UNAUTHORIZED,
            )
        await self.repository.revoke_token(token_digest(token), claims.expires_at)
        await self.session.commit()
