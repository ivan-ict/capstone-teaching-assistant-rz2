from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import get_settings
from app.common.db_models import AccountStatus, SupervisorProfile, User, UserRole
from app.common.email import (
    EmailDeliveryError,
    EmailMessageData,
    EmailSender,
    build_account_created_email,
    build_password_reset_email,
)
from app.common.errors import ApiError, NotFoundError
from app.common.security import generate_password, hash_password
from app.modules.admin.supervisors.supervisor_model import (
    SupervisorCreateDTO,
    SupervisorCreateResponseDTO,
    SupervisorDetailDTO,
    SupervisorFacultySummaryDTO,
    SupervisorListDTO,
    SupervisorListItemDTO,
    SupervisorPasswordResetResponseDTO,
    SupervisorProfileDTO,
    SupervisorStatusResponseDTO,
    SupervisorUpdateDTO,
    SupervisorUpdateResponseDTO,
)
from app.modules.admin.supervisors.supervisor_repository import SupervisorRepository
from app.modules.semesters.semester_model import SemesterSummaryDTO
from app.modules.semesters.semester_service import SemesterService


class SupervisorService:
    def __init__(
        self,
        session: AsyncSession,
        repository: SupervisorRepository | None = None,
    ) -> None:
        self.session = session
        self.repository = repository or SupervisorRepository(session)

    async def create_supervisor(
        self, payload: SupervisorCreateDTO, email_sender: EmailSender
    ) -> SupervisorCreateResponseDTO:
        await SemesterService(self.session).get(payload.semester_id, writable=True)
        await self._ensure_faculty(payload.faculty_id)
        if await self.repository.username_exists(payload.username):
            raise ApiError(
                "DUPLICATE_USERNAME", "Username already exists.", status.HTTP_409_CONFLICT
            )
        if await self.repository.email_exists(str(payload.email)):
            raise ApiError("DUPLICATE_EMAIL", "Email already exists.", status.HTTP_409_CONFLICT)
        user_id = uuid4()
        password = generate_password()
        user = User(
            id=user_id,
            username=payload.username,
            password_hash=hash_password(password),
            role=UserRole.SUPERVISOR,
            status=AccountStatus.ACTIVE,
        )
        profile = SupervisorProfile(
            user_id=user_id,
            faculty_id=payload.faculty_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=str(payload.email),
            phone=payload.phone,
            semester_id=payload.semester_id,
        )
        try:
            user, profile = await self.repository.create_user_and_profile(user, profile)
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._duplicate_supervisor_error(exc) from exc
        # Send before committing so an account never exists without its owner receiving
        # the generated password.
        message = build_account_created_email(
            to=profile.email,
            first_name=profile.first_name,
            username=user.username,
            password=password,
            login_url=get_settings().frontend_login_url,
        )
        await self._send_or_rollback(
            email_sender,
            message,
            "Account was not created because the welcome email could not be sent.",
        )
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._duplicate_supervisor_error(exc) from exc
        return SupervisorCreateResponseDTO(
            id=user.id,
            username=user.username,
            status=user.status,
            profile=self._profile_dto(profile),
        )

    async def list_supervisors(
        self,
        search: str | None,
        faculty_id: UUID | None,
        status_filter: AccountStatus | None,
        semester_id: UUID | None,
        sort_by: str,
        sort_order: str,
        page: int,
        page_size: int,
    ) -> SupervisorListDTO:
        allowed_sort_fields = {
            "full_name",
            "username",
            "email",
            "faculty",
            "semester",
            "created_at",
            "updated_at",
        }
        if sort_by not in allowed_sort_fields:
            raise ApiError("INVALID_SORT_FIELD", "Unsupported supervisor sort field.")
        if sort_order not in {"asc", "desc"}:
            raise ApiError("INVALID_SORT_ORDER", "sort_order must be 'asc' or 'desc'.")
        rows, total = await self.repository.list_supervisors(
            search,
            faculty_id,
            status_filter,
            semester_id,
            sort_by,
            sort_order,
            page,
            page_size,
        )
        return SupervisorListDTO(
            items=[
                SupervisorListItemDTO(
                    id=user.id,
                    username=user.username,
                    first_name=profile.first_name,
                    last_name=profile.last_name,
                    email=profile.email,
                    phone=profile.phone,
                    semester=SemesterSummaryDTO.model_validate(profile.semester),
                    status=user.status,
                    faculty=SupervisorFacultySummaryDTO(id=faculty.id, name=faculty.name),
                    created_at=user.created_at,
                    updated_at=max(user.updated_at, profile.updated_at),
                )
                for user, profile, faculty in rows
            ],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_supervisor(self, supervisor_id: UUID) -> SupervisorDetailDTO:
        user, profile, _faculty = await self._get_supervisor(supervisor_id)
        return SupervisorDetailDTO(
            id=user.id,
            username=user.username,
            status=user.status,
            profile=self._profile_dto(profile),
        )

    async def update_supervisor(
        self, supervisor_id: UUID, payload: SupervisorUpdateDTO
    ) -> SupervisorUpdateResponseDTO:
        _user, profile, _faculty = await self._get_supervisor(supervisor_id)
        if payload.faculty_id is not None:
            await self._ensure_faculty(payload.faculty_id)
            profile.faculty_id = payload.faculty_id
        if payload.first_name is not None:
            profile.first_name = payload.first_name
        if payload.last_name is not None:
            profile.last_name = payload.last_name
        if payload.email is not None:
            email = str(payload.email)
            if await self.repository.email_exists(email, supervisor_id):
                raise ApiError("DUPLICATE_EMAIL", "Email already exists.", status.HTTP_409_CONFLICT)
            profile.email = email
        if "phone" in payload.model_fields_set:
            profile.phone = payload.phone
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._duplicate_supervisor_error(exc) from exc
        return SupervisorUpdateResponseDTO(id=supervisor_id, profile=self._profile_dto(profile))

    async def update_status(
        self, supervisor_id: UUID, status_value: AccountStatus
    ) -> SupervisorStatusResponseDTO:
        user, _profile, _faculty = await self._get_supervisor(supervisor_id)
        user.status = status_value
        await self.session.commit()
        return SupervisorStatusResponseDTO(id=user.id, status=user.status)

    async def reset_password(
        self, supervisor_id: UUID, email_sender: EmailSender
    ) -> SupervisorPasswordResetResponseDTO:
        user, profile, _faculty = await self._get_supervisor(supervisor_id)
        password = generate_password()
        user.password_hash = hash_password(password)
        message = build_password_reset_email(
            to=profile.email,
            first_name=profile.first_name,
            username=user.username,
            password=password,
            login_url=get_settings().frontend_login_url,
        )
        await self._send_or_rollback(
            email_sender,
            message,
            "Password was not reset because the email could not be sent.",
        )
        await self.session.commit()
        return SupervisorPasswordResetResponseDTO(
            id=user.id,
            email=profile.email,
            message=f"A new password has been sent to {profile.email}.",
        )

    async def _send_or_rollback(
        self, email_sender: EmailSender, message: EmailMessageData, failure_message: str
    ) -> None:
        try:
            await email_sender.send(message)
        except EmailDeliveryError as exc:
            await self.session.rollback()
            raise ApiError(
                "EMAIL_DELIVERY_FAILED", failure_message, status.HTTP_502_BAD_GATEWAY
            ) from exc

    async def _get_supervisor(self, supervisor_id: UUID) -> tuple[User, SupervisorProfile, object]:
        row = await self.repository.get_supervisor(supervisor_id)
        if row is None:
            raise NotFoundError("Supervisor not found.")
        return row

    async def soft_delete_supervisor(self, supervisor_id: UUID) -> None:
        user, profile, _faculty = await self._get_supervisor(supervisor_id)
        now = datetime.now(UTC)
        user.deleted_at = now
        profile.deleted_at = now
        await self.session.commit()

    async def _ensure_faculty(self, faculty_id: UUID) -> None:
        if not await self.repository.faculty_exists(faculty_id):
            raise NotFoundError("Faculty not found.")

    def _profile_dto(self, profile: SupervisorProfile) -> SupervisorProfileDTO:
        return SupervisorProfileDTO(
            first_name=profile.first_name,
            last_name=profile.last_name,
            email=profile.email,
            phone=profile.phone,
            faculty_id=profile.faculty_id,
            semester=SemesterSummaryDTO.model_validate(profile.semester),
        )

    def _duplicate_supervisor_error(self, exc: IntegrityError) -> ApiError:
        message = str(exc.orig).lower()
        constraint_name = self._constraint_name(exc)
        conflict_context = " ".join(value for value in (constraint_name, message) if value)
        if any(
            marker in conflict_context
            for marker in ("username", "uq_users_active_username", "uq_users_username")
        ):
            return ApiError(
                "DUPLICATE_USERNAME", "Username already exists.", status.HTTP_409_CONFLICT
            )
        if any(
            marker in conflict_context
            for marker in (
                "email",
                "uq_supervisor_profiles_active_email",
                "uq_supervisor_profiles_email",
            )
        ):
            return ApiError("DUPLICATE_EMAIL", "Email already exists.", status.HTTP_409_CONFLICT)
        return ApiError(
            "SUPERVISOR_CONFLICT",
            "Supervisor record conflicts with existing data.",
            status.HTTP_409_CONFLICT,
        )

    @staticmethod
    def _constraint_name(exc: IntegrityError) -> str:
        diag = getattr(exc.orig, "diag", None)
        constraint_name = getattr(diag, "constraint_name", None)
        return str(constraint_name).lower() if constraint_name else ""
