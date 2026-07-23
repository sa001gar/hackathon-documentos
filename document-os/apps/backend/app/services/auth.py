"""Auth service: registration, login, token refresh."""
import jwt
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import Project, User, UserSettings, Workspace
from app.repositories import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair
from app.services.activity import log_activity


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def register(self, data: RegisterRequest) -> tuple[User, TokenPair]:
        if self.users.get_by_email(data.email):
            raise ConflictError("A user with this email already exists")
        user = User(
            email=data.email.lower(), name=data.name,
            hashed_password=hash_password(data.password),
        )
        self.users.add(user)
        self.db.add(UserSettings(user_id=user.id))

        # Bootstrap a default workspace + project so the UI is never empty.
        workspace = Workspace(name=f"{data.name}'s Workspace", owner_id=user.id)
        self.db.add(workspace)
        self.db.flush()
        project = Project(
            workspace_id=workspace.id, name="Getting Started",
            description="Your first project — create a document from the 'New Document' button.",
        )
        self.db.add(project)
        self.db.commit()
        log_activity(self.db, user.id, "user.registered", "user", user.id)
        self.db.commit()
        return user, self._tokens(user)

    def login(self, data: LoginRequest) -> tuple[User, TokenPair]:
        user = self.users.get_by_email(data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")
        return user, self._tokens(user)

    def refresh(self, refresh_token: str) -> TokenPair:
        try:
            user_id = decode_token(refresh_token, expected_type="refresh")
        except jwt.PyJWTError as exc:
            raise UnauthorizedError("Invalid or expired refresh token") from exc
        user = self.users.get(user_id)
        if not user or not user.is_active:
            raise UnauthorizedError("User not found")
        return self._tokens(user)

    @staticmethod
    def _tokens(user: User) -> TokenPair:
        return TokenPair(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )
