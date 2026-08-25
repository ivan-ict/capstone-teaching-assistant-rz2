from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.common.config import DEFAULT_JWT_SECRET_KEY, Settings
from app.common.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_and_verify() -> None:
    hashed = hash_password("Password123!")

    assert verify_password("Password123!", hashed)
    assert not verify_password("wrong", hashed)


def test_invalid_password_hash_returns_false() -> None:
    assert not verify_password("Password123!", "not-a-valid-hash")


def test_access_token_round_trip() -> None:
    user_id = uuid4()

    token = create_access_token(user_id)

    assert decode_access_token(token) == user_id


def test_default_jwt_secret_is_rejected_outside_local_environments() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_environment="production",
            jwt_secret_key=DEFAULT_JWT_SECRET_KEY,
        )


def test_unsupported_jwt_algorithm_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_ALGORITHM", "none")
    with pytest.raises(ValidationError):
        Settings()


@pytest.mark.parametrize(
    ("env_name", "env_value"),
    [
        ("EMBEDDING_DIMENSION", "0"),
        ("RAG_TOP_K", "0"),
        ("CHUNK_SIZE", "0"),
        ("CHUNK_OVERLAP", "-1"),
        ("MAX_UPLOAD_BYTES", "0"),
        ("ACCESS_TOKEN_EXPIRE_MINUTES", "0"),
    ],
)
def test_invalid_numeric_settings_are_rejected(
    monkeypatch: pytest.MonkeyPatch, env_name: str, env_value: str
) -> None:
    monkeypatch.setenv(env_name, env_value)
    with pytest.raises(ValidationError):
        Settings()


def test_invalid_chunk_overlap_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHUNK_SIZE", "100")
    monkeypatch.setenv("CHUNK_OVERLAP", "100")
    with pytest.raises(ValidationError):
        Settings()


def test_wildcard_cors_origin_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(cors_allowed_origins=["*"])
