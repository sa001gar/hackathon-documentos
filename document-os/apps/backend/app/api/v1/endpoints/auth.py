from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserOut,
)
from app.services.auth import AuthService

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user, _ = AuthService(db).register(data)
    return user


@router.post("/login", response_model=TokenPair)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    _, tokens = AuthService(db).login(data)
    return tokens


@router.post("/register-with-tokens", response_model=TokenPair, status_code=201)
def register_with_tokens(data: RegisterRequest, db: Session = Depends(get_db)):
    """Convenience endpoint for the SPA: register and immediately get tokens."""
    _, tokens = AuthService(db).register(data)
    return tokens


@router.post("/refresh", response_model=TokenPair)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    return AuthService(db).refresh(data.refresh_token)
