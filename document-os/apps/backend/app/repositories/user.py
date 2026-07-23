"""User and per-user settings repositories."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User, UserSettings
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def get_by_email(self, db: Session, email: str) -> User | None:
        """Find a user by email (case-insensitive)."""
        stmt = select(User).where(func.lower(User.email) == email.lower())
        return db.scalar(stmt)


class UserSettingsRepository(BaseRepository[UserSettings]):
    def get_by_user(self, db: Session, user_id: str) -> UserSettings | None:
        """Return the settings row for a user, if it exists."""
        stmt = select(UserSettings).where(UserSettings.user_id == user_id)
        return db.scalar(stmt)
