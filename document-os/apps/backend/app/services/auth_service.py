"""Auth business logic: registration and authentication."""
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import hash_password, verify_password
from app.models import User
from app.repositories import user_repo
from app.schemas.auth import RegisterRequest
from app.schemas.project import ProjectCreate
from app.schemas.workspace import WorkspaceCreate
from app.services import project_service, workspace_service


def register(db: Session, data: RegisterRequest) -> User:
    """Register a user and bootstrap a default workspace + project."""
    if user_repo.get_by_email(db, data.email) is not None:
        raise ConflictError("A user with this email already exists")
    user = user_repo.create(
        db,
        obj_in={
            "email": data.email.lower(),
            "hashed_password": hash_password(data.password),
            "full_name": data.full_name,
        },
    )
    workspace = workspace_service.create(
        db, user.id, WorkspaceCreate(name="Personal Workspace")
    )
    project_service.create(db, workspace.id, ProjectCreate(name="Getting Started"))
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    """Verify credentials and return the user; 401 on any failure."""
    user = user_repo.get_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("Invalid email or password")
    return user
