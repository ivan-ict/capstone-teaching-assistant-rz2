from sqlalchemy.exc import IntegrityError

from app.modules.admin.supervisors.supervisor_service import SupervisorService


class FakeDiag:
    def __init__(self, constraint_name: str) -> None:
        self.constraint_name = constraint_name


class FakeOrig(Exception):
    def __init__(self, constraint_name: str) -> None:
        self.diag = FakeDiag(constraint_name)

    def __str__(self) -> str:
        return "duplicate key value violates unique constraint"


def integrity_error(constraint_name: str) -> IntegrityError:
    return IntegrityError("insert", {}, FakeOrig(constraint_name))


def test_duplicate_supervisor_error_maps_active_username_index() -> None:
    error = SupervisorService._duplicate_supervisor_error(
        SupervisorService.__new__(SupervisorService),
        integrity_error("uq_users_active_username"),
    )

    assert error.code == "DUPLICATE_USERNAME"
    assert error.message == "Username already exists."


def test_duplicate_supervisor_error_maps_active_email_index() -> None:
    error = SupervisorService._duplicate_supervisor_error(
        SupervisorService.__new__(SupervisorService),
        integrity_error("uq_supervisor_profiles_active_email"),
    )

    assert error.code == "DUPLICATE_EMAIL"
    assert error.message == "Email already exists."
