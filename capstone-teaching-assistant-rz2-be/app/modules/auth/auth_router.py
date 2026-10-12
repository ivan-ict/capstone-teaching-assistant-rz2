from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import get_current_access_token
from app.common.database import get_db_session
from app.common.email import EmailSender, get_email_sender
from app.modules.auth.auth_model import (
    ForgotPasswordRequestDTO,
    ForgotPasswordResponseDTO,
    LoginRequestDTO,
    LoginResponseDTO,
)
from app.modules.auth.auth_service import AuthService

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
AccessTokenDependency = Annotated[str, Depends(get_current_access_token)]
EmailSenderDependency = Annotated[EmailSender, Depends(get_email_sender)]


@auth_router.post("/login", response_model=LoginResponseDTO)
async def login(payload: LoginRequestDTO, session: DatabaseSessionDependency):
    return await AuthService(session).login(payload.username, payload.password)


@auth_router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponseDTO,
    status_code=status.HTTP_202_ACCEPTED,
)
async def forgot_password(
    payload: ForgotPasswordRequestDTO,
    request: Request,
    session: DatabaseSessionDependency,
    email_sender: EmailSenderDependency,
):
    client_ip = request.client.host if request.client else None
    return await AuthService(session).forgot_password(payload.identifier, client_ip, email_sender)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    access_token: AccessTokenDependency,
    session: DatabaseSessionDependency,
):
    await AuthService(session).logout(access_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
