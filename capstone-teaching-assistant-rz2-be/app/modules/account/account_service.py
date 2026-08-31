from uuid import UUID

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApiError, NotFoundError
from app.common.security import (
    decode_access_token_claims,
    hash_password,
    token_digest,
    verify_password,
)
from app.modules.account.account_model import (
    AccountDTO,
    AccountFacultyDTO,
    AccountProfileDTO,
    PasswordChangeResponseDTO,
)
from app.modules.account.account_repository import AccountRepository
from app.modules.auth.auth_repository import AuthRepository


class AccountService:
    def __init__(
        self,
        session: AsyncSession,
        repository: AccountRepository | None = None,
    ) -> None:
        self.session = session
        self.repository = repository or AccountRepository(session)

    async def get_account(self, user_id: UUID) -> AccountDTO:
        user = await self.repository.get_user(user_id)
        if user is None or user.deleted_at is not None:
            raise NotFoundError("Account not found.")
        profile_row = await self.repository.get_profile_with_faculty(user_id)
        profile = None
        if profile_row is not None:
            supervisor_profile, faculty = profile_row
            profile = AccountProfileDTO(
                first_name=supervisor_profile.first_name,
                last_name=supervisor_profile.last_name,
                email=supervisor_profile.email,
                phone=supervisor_profile.phone,
                faculty=AccountFacultyDTO(
                    id=faculty.id,
                    code=faculty.code,
                    name=faculty.name,
                ),
                teaching_year=supervisor_profile.teaching_year,
                teaching_semester=supervisor_profile.teaching_semester,
            )
        return AccountDTO(
            id=user.id,
            username=user.username,
            role=user.role,
            status=user.status,
            created_at=user.created_at,
            profile=profile,
        )

    async def change_password(
        self, user_id: UUID, current_password: str, new_password: str, current_token: str
    ) -> PasswordChangeResponseDTO:
        user = await self.repository.get_user(user_id)
        if user is None or user.deleted_at is not None:
            raise NotFoundError("Account not found.")
        if not verify_password(current_password, user.password_hash):
            raise ApiError(
                "INVALID_CREDENTIALS",
                "Current password is incorrect.",
                status.HTTP_401_UNAUTHORIZED,
            )
        claims = decode_access_token_claims(current_token)
        if claims is None:
            raise ApiError(
                "UNAUTHENTICATED",
                "Authentication credentials were not provided or are invalid.",
                status.HTTP_401_UNAUTHORIZED,
            )
        user.password_hash = hash_password(new_password)
        await AuthRepository(self.session).revoke_token(
            token_digest(current_token),
            claims.expires_at,
        )
        await self.session.commit()
        return PasswordChangeResponseDTO(message="Password changed successfully.")
