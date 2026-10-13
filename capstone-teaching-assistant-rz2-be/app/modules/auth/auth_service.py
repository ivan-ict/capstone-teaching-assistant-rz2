import logging

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import get_settings
from app.common.db_models import AccountStatus
from app.common.email import EmailDeliveryError, EmailSender, build_password_reset_email
from app.common.errors import ApiError
from app.common.rate_limit import password_reset_limiter
from app.common.security import (
    create_access_token,
    decode_access_token_claims,
    generate_password,
    hash_password,
    token_digest,
    verify_password,
)
from app.modules.auth.auth_model import ForgotPasswordResponseDTO, LoginResponseDTO
from app.modules.auth.auth_repository import AuthRepository

logger = logging.getLogger(__name__)

FORGOT_PASSWORD_MESSAGE = "A new password has been sent to the email on file."


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

    async def forgot_password(
        self, identifier: str, client_ip: str | None, email_sender: EmailSender
    ) -> ForgotPasswordResponseDTO:
        settings = get_settings()
        # The per-IP limit runs before the lookup so account existence cannot be probed in bulk.
        if client_ip and not await password_reset_limiter.allow(
            f"ip:{client_ip}",
            settings.password_reset_ip_limit,
            settings.password_reset_ip_window_seconds,
        ):
            raise ApiError(
                "TOO_MANY_REQUESTS",
                "Too many password reset requests. Please try again later.",
                status.HTTP_429_TOO_MANY_REQUESTS,
            )
        row = await self.repository.get_supervisor_by_identifier(identifier)
        if row is None:
            raise ApiError(
                "ACCOUNT_NOT_FOUND",
                "No account matches that username or email.",
                status.HTTP_404_NOT_FOUND,
            )
        user, profile = row
        if user.status != AccountStatus.ACTIVE:
            raise ApiError(
                "ACCOUNT_INACTIVE",
                "This account is inactive. Please contact an administrator.",
                status.HTTP_403_FORBIDDEN,
            )
        if not await password_reset_limiter.allow(
            f"user:{user.id}", 1, settings.password_reset_cooldown_seconds
        ):
            raise ApiError(
                "RESET_COOLDOWN",
                "A new password was sent recently. Please check your email or try again later.",
                status.HTTP_429_TOO_MANY_REQUESTS,
            )
        password = generate_password()
        user.password_hash = hash_password(password)
        message = build_password_reset_email(
            to=profile.email,
            first_name=profile.first_name,
            username=user.username,
            password=password,
            login_url=settings.frontend_login_url,
        )
        try:
            await email_sender.send(message)
        except EmailDeliveryError:
            logger.warning("Password reset email failed for user %s; password unchanged.", user.id)
            await self.session.rollback()
            raise ApiError(
                "EMAIL_DELIVERY_FAILED",
                "We could not send the email. Please try again later.",
                status.HTTP_502_BAD_GATEWAY,
            ) from None
        await self.session.commit()
        return ForgotPasswordResponseDTO(message=FORGOT_PASSWORD_MESSAGE)
