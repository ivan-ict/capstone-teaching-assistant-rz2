"""Explicit local reset before the semester migration; preserves admins and faculties."""

import argparse
import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)


async def main() -> None:
    from sqlalchemy import inspect, text

    from app.common.config import get_settings
    from app.common.database import engine
    from app.common.object_storage import ObjectStorageClient

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-reset", action="store_true", required=True)
    parser.parse_args()
    settings = get_settings()
    if settings.app_environment.lower() != "development":
        raise RuntimeError("Workspace reset requires APP_ENVIRONMENT=development.")
    storage = ObjectStorageClient(settings)
    async with engine.begin() as connection:
        tables = await connection.run_sync(lambda conn: set(inspect(conn).get_table_names()))
        # Stop the app before running: object deletion cannot roll back with the database.
        paths = (
            list((await connection.execute(text("SELECT storage_path FROM files"))).scalars())
            if "files" in tables
            else []
        )
        failures = []
        for path in paths:
            try:
                await asyncio.to_thread(storage.delete_object, path)
            except Exception as exc:
                failures.append((path, str(exc)))
        print(f"Stored files removed: {len(paths) - len(failures)}; failed: {len(failures)}")
        if failures:
            for path, error in failures:
                print(f"FAILED {path}: {error}")
            raise RuntimeError(
                "Reset incomplete; database retained. Resolve storage failures and rerun."
            )
        for table in (
            "message_files",
            "document_chunks",
            "messages",
            "conversations",
            "files",
            "projects",
            "supervisor_profiles",
            "semesters",
        ):
            if table in tables:
                count = await connection.scalar(text(f"SELECT count(*) FROM {table}"))
                await connection.execute(text(f"DELETE FROM {table}"))
                print(f"Removed {table}: {count}")
        count = await connection.scalar(
            text("SELECT count(*) FROM users WHERE role = 'SUPERVISOR'")
        )
        await connection.execute(text("DELETE FROM users WHERE role = 'SUPERVISOR'"))
        print(f"Removed supervisor accounts: {count}")
    print("Development reset committed. Admin accounts and faculties retained.")


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop)
