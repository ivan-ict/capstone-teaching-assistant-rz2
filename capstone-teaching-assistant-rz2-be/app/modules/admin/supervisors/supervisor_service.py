from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import AccountStatus, SupervisorProfile, User, UserRole
from app.common.errors import ApiError, NotFoundError
from app.common.security import hash_password
from app.modules.admin.supervisors.supervisor_model import (
    SupervisorCreateDTO,
    SupervisorCreateResponseDTO,
    SupervisorDetailDTO,
    SupervisorFacultySummaryDTO,
    SupervisorListDTO,
    SupervisorListItemDTO,
    SupervisorProfileDTO,
    SupervisorStatusResponseDTO,
    SupervisorUpdateDTO,
    SupervisorUpdateResponseDTO,
)
from app.modules.admin.supervisors.supervisor_repository import SupervisorRepository


class SupervisorService:
    def __init__(
        self,
        session: AsyncSession,
        repository: SupervisorRepository | None = None,
    ) -> None:
        self.session = session
        self.repository = repository or SupervisorRepository(session)

    async def create_supervisor(self, payload: SupervisorCreateDTO) -> SupervisorCreateResponseDTO:
        await self._ensure_faculty(payload.faculty_id)
        if await self.repository.username_exists(payload.username):
            raise ApiError(
                "DUPLICATE_USERNAME", "Username already exists.", status.HTTP_409_CONFLICT
            )
        if await self.repository.email_exists(str(payload.email)):
            raise ApiError("DUPLICATE_EMAIL", "Email already exists.", status.HTTP_409_CONFLICT)
        user_id = uuid4()
        user = User(
            id=user_id,
            username=payload.username,
            password_hash=hash_password(payload.password),
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
            teaching_year=payload.teaching_year,
            teaching_semester=payload.teaching_semester,
        )
        try:
            user, profile = await self.repository.create_user_and_profile(user, profile)
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
        page: int,
        page_size: int,
    ) -> SupervisorListDTO:
        rows, total = await self.repository.list_supervisors(
            search, faculty_id, status_filter, page, page_size
        )
        return SupervisorListDTO(
            items=[
                SupervisorListItemDTO(
                    id=user.id,
                    username=user.username,
                    first_name=profile.first_name,
                    last_name=profile.last_name,
                    email=profile.email,
                    status=user.status,
                    faculty=SupervisorFacultySummaryDTO(id=faculty.id, name=faculty.name),
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
        if payload.email is not None:
            email = str(payload.email)
            if await self.repository.email_exists(email, supervisor_id):
                raise ApiError("DUPLICATE_EMAIL", "Email already exists.", status.HTTP_409_CONFLICT)
            profile.email = email
        if "phone" in payload.model_fields_set:
            profile.phone = payload.phone
        if "teaching_year" in payload.model_fields_set:
            profile.teaching_year = payload.teaching_year
        if "teaching_semester" in payload.model_fields_set:
            profile.teaching_semester = payload.teaching_semester
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
            teaching_year=profile.teaching_year,
            teaching_semester=profile.teaching_semester,
        )

    def _duplicate_supervisor_error(self, exc: IntegrityError) -> ApiError:
        message = str(exc.orig).lower()
        if "username" in message:
            return ApiError(
                "DUPLICATE_USERNAME", "Username already exists.", status.HTTP_409_CONFLICT
            )
        if "email" in message:
            return ApiError("DUPLICATE_EMAIL", "Email already exists.", status.HTTP_409_CONFLICT)
        return ApiError(
            "SUPERVISOR_CONFLICT",
            "Supervisor record conflicts with existing data.",
            status.HTTP_409_CONFLICT,
        )
