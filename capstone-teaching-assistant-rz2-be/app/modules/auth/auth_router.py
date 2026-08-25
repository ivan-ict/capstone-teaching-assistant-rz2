from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import get_current_access_token
from app.common.database import get_db_session
from app.modules.auth.auth_model import LoginRequestDTO, LoginResponseDTO
from app.modules.auth.auth_service import AuthService

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
AccessTokenDependency = Annotated[str, Depends(get_current_access_token)]


@auth_router.post("/login", response_model=LoginResponseDTO)
async def login(payload: LoginRequestDTO, session: DatabaseSessionDependency):
    return await AuthService(session).login(payload.username, payload.password)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    access_token: AccessTokenDependency,
    session: DatabaseSessionDependency,
):
    await AuthService(session).logout(access_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
