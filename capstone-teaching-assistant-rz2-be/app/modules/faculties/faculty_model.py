from uuid import UUID

from pydantic import BaseModel


class FacultyDTO(BaseModel):
    id: UUID
    code: str
    name: str


class FacultyListDTO(BaseModel):
    items: list[FacultyDTO]
