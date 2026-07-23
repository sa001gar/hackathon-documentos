"""Authentication endpoints (public)."""
import jwt
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.errors import UnauthorizedError
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.db.session import get_db
from app.repositories import user_repo
from app.schemas.auth import AuthResponse, RefreshRequest, RegisterRequest
from app.schemas.user import UserRead
from app.services import auth_service

router = APIRouter()


def _auth_response(user) -> AuthResponse:
    return AuthResponse(
        user=UserRead.model_validate(user),
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user = auth_service.register(db, data)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, form.username.lower(), form.password)
    return _auth_response(user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    try:
        user_id = decode_token(data.refresh_token, "refresh")
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired refresh token") from exc
    user = user_repo.get(db, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid or expired refresh token")
    return _auth_response(user)
