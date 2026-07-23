from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.auth import UserOut, UserSettingsOut, UserSettingsUpdate
from app.schemas.misc import WorkspaceOut
from app.services.projects import ProjectService

router = APIRouter()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me/settings", response_model=UserSettingsOut)
def update_settings(
    data: UserSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = user.settings
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(settings, field, value)
    db.commit()
    return settings


@router.get("/me/workspaces", response_model=list[WorkspaceOut])
def my_workspaces(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return ProjectService(db).list_workspaces(user)
