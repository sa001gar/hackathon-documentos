"""Current-user profile + settings."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.repositories import user_repo
from app.schemas.user import UserRead, UserSettingsRead, UserSettingsUpdate, UserUpdate
from app.services import settings_service

router = APIRouter()


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserRead)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return user_repo.update(db, db_obj=current_user, obj_in=data)


@router.get("/me/settings", response_model=UserSettingsRead)
def read_settings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return settings_service.get_or_create(db, current_user.id)


@router.patch("/me/settings", response_model=UserSettingsRead)
def update_settings(
    data: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = settings_service.get_or_create(db, current_user.id)
    return settings_service.update(db, settings, data)
