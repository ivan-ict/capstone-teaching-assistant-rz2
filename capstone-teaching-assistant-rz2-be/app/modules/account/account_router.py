from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.auth import CurrentUser, get_current_access_token, get_current_user
from app.common.database import get_db_session
from app.modules.account.account_model import (
    AccountDTO,
    PasswordChangeDTO,
    PasswordChangeResponseDTO,
)
from app.modules.account.account_service import AccountService

account_router = APIRouter(prefix="/account", tags=["Account"])
CurrentUserDependency = Annotated[CurrentUser, Depends(get_current_user)]
DatabaseSessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
AccessTokenDependency = Annotated[str, Depends(get_current_access_token)]


@account_router.get("", response_model=AccountDTO)
async def get_account(
    current_user: CurrentUserDependency,
    session: DatabaseSessionDependency,
):
    return await AccountService(session).get_account(current_user.id)


@account_router.put("/password", response_model=PasswordChangeResponseDTO)
async def change_password(
    payload: PasswordChangeDTO,
    current_user: CurrentUserDependency,
    access_token: AccessTokenDependency,
    session: DatabaseSessionDependency,
):
    return await AccountService(session).change_password(
        current_user.id,
        payload.current_password,
        payload.new_password,
        access_token,
    )
