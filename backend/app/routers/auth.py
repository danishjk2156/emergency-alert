from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import generate_token, verify_password
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate an admin user by email and password.
    Returns Bearer token and user details.
    """
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(email)).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = generate_token(user.id)
    return LoginResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )
