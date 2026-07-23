"""Per-user settings business logic."""
from sqlalchemy.orm import Session

from app.models import UserSettings
from app.repositories import user_settings_repo
from app.schemas.user import UserSettingsUpdate


def get_or_create(db: Session, user_id: str) -> UserSettings:
    """Return the user's settings, creating defaults on first access."""
    settings = user_settings_repo.get_by_user(db, user_id)
    if settings is None:
        settings = user_settings_repo.create(db, obj_in={"user_id": user_id})
    return settings


def update(db: Session, settings: UserSettings, data: UserSettingsUpdate) -> UserSettings:
    """Apply a partial update to a settings row."""
    return user_settings_repo.update(db, db_obj=settings, obj_in=data)
