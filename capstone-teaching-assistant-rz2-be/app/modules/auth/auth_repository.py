from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.db_models import RevokedToken, SupervisorProfile, User, UserRole


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_username(self, username: str) -> User | None:
        query = select(User).where(User.username == username.lower(), User.deleted_at.is_(None))
        return await self.session.scalar(query)

    async def get_supervisor_by_identifier(
        self, identifier: str
    ) -> tuple[User, SupervisorProfile] | None:
        query = (
            select(User, SupervisorProfile)
            .join(SupervisorProfile, SupervisorProfile.user_id == User.id)
            .where(
                User.role == UserRole.SUPERVISOR,
                User.deleted_at.is_(None),
                SupervisorProfile.deleted_at.is_(None),
                or_(
                    User.username == identifier.lower(),
                    func.lower(SupervisorProfile.email) == identifier.lower(),
                ),
            )
            .limit(1)
        )
        row = (await self.session.execute(query)).first()
        return (row[0], row[1]) if row else None

    async def revoke_token(self, token_hash: str, expires_at: datetime) -> None:
        values = {"token_hash": token_hash, "expires_at": expires_at}
        dialect_name = self.session.get_bind().dialect.name
        if dialect_name == "sqlite":
            statement = sqlite_insert(RevokedToken).values(**values)
        else:
            statement = postgresql_insert(RevokedToken).values(**values)
        await self.session.execute(statement.on_conflict_do_nothing(index_elements=["token_hash"]))

    async def is_token_revoked(self, token_hash: str) -> bool:
        query = select(RevokedToken.token_hash).where(
            RevokedToken.token_hash == token_hash,
            RevokedToken.expires_at > datetime.now(UTC),
        )
        return await self.session.scalar(query) is not None

    async def purge_expired_revoked_tokens(self) -> None:
        await self.session.execute(
            delete(RevokedToken).where(RevokedToken.expires_at <= datetime.now(UTC))
        )
