import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)


LOCAL_ADMIN_ID = UUID("00000000-0000-0000-0000-000000000001")


async def main() -> None:
    from sqlalchemy import select

    from app.common.config import get_settings
    from app.common.database import AsyncSessionLocal
    from app.common.db_models import AccountStatus, User, UserRole
    from app.common.security import hash_password

    settings = get_settings()
    if settings.app_environment.lower() != "development":
        msg = "Local admin seeding is allowed only when APP_ENVIRONMENT=development."
        raise RuntimeError(msg)

    admin_username = settings.local_admin_username.strip().lower()

    async with AsyncSessionLocal() as session:
        existing_user_id = await session.scalar(
            select(User.id).where(
                User.username == admin_username,
                User.deleted_at.is_(None),
            )
        )
        if existing_user_id is not None:
            print(f"Local admin already exists: {admin_username}")
            return

        session.add(
            User(
                id=LOCAL_ADMIN_ID,
                username=admin_username,
                password_hash=hash_password(settings.local_admin_password),
                role=UserRole.ADMIN,
                status=AccountStatus.ACTIVE,
            )
        )
        await session.commit()
        print(f"Created local admin: {admin_username}")


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop)
