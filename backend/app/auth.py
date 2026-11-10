import hashlib
import secrets
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

# In-memory dictionary mapping token string to user_id
ACTIVE_TOKENS: dict[str, int] = {}

PASSWORD_SALT = "emergency_salt_codeclash_2026"


def hash_password(password: str) -> str:
    """Generate deterministic SHA-256 hash using salt without extra dependencies."""
    salted = f"{PASSWORD_SALT}:{password}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify password by comparing hashes."""
    return hash_password(plain_password) == stored_hash


def generate_token(user_id: int) -> str:
    """Generate a secure hex token and register it in memory."""
    token = secrets.token_hex(24)
    ACTIVE_TOKENS[token] = user_id
    return token


def require_admin(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency to enforce admin role via Bearer token.
    Raises 401 if token is missing, invalid, or user is not an admin.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'",
        )

    token = parts[1]
    user_id = ACTIVE_TOKENS.get(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin privileges required",
        )

    return user
