import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.common.config import get_settings

password_hash = PasswordHash.recommended()
MAX_PASSWORD_LENGTH = 128
GENERATED_PASSWORD_LENGTH = 14
# Ambiguous characters (0/O, 1/l/I) are excluded so emailed passwords are easy to type.
_PASSWORD_CHARACTER_CLASSES = (
    "abcdefghijkmnopqrstuvwxyz",
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "23456789",
    "!@#$%^&*-_=+?",
)


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: UUID
    expires_at: datetime


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def generate_password(length: int = GENERATED_PASSWORD_LENGTH) -> str:
    if length < len(_PASSWORD_CHARACTER_CLASSES):
        msg = "Generated password length is too short."
        raise ValueError(msg)
    alphabet = "".join(_PASSWORD_CHARACTER_CLASSES)
    characters = [secrets.choice(group) for group in _PASSWORD_CHARACTER_CLASSES]
    characters += [secrets.choice(alphabet) for _ in range(length - len(characters))]
    secrets.SystemRandom().shuffle(characters)
    return "".join(characters)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except UnknownHashError:
        return False


def create_access_token(user_id: UUID) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token_claims(token: str) -> AccessTokenClaims | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        expires_at = payload.get("exp")
        if not isinstance(subject, str) or not isinstance(expires_at, int):
            return None
        return AccessTokenClaims(
            user_id=UUID(subject),
            expires_at=datetime.fromtimestamp(expires_at, UTC),
        )
    except jwt.PyJWTError, ValueError:
        return None


def decode_access_token(token: str) -> UUID | None:
    claims = decode_access_token_claims(token)
    return claims.user_id if claims else None


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
