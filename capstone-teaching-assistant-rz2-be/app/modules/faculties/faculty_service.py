from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.faculties.faculty_model import FacultyDTO, FacultyListDTO
from app.modules.faculties.faculty_repository import FacultyRepository


class FacultyService:
    def __init__(self, session: AsyncSession, repository: FacultyRepository | None = None) -> None:
        self.repository = repository or FacultyRepository(session)

    async def list_active(self) -> FacultyListDTO:
        faculties = await self.repository.list_active()
        return FacultyListDTO(
            items=[
                FacultyDTO(id=faculty.id, code=faculty.code, name=faculty.name)
                for faculty in faculties
            ]
        )
