"""Workspace business logic."""
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, NotFoundError
from app.models import Workspace
from app.repositories import workspace_repo
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate
from app.utils.markdown import slugify


def list_for_user(db: Session, user_id: str) -> list[Workspace]:
    """List workspaces owned by a user."""
    return workspace_repo.list_for_user(db, user_id)


def create(db: Session, owner_id: str, data: WorkspaceCreate) -> Workspace:
    """Create a workspace with a unique slug derived from its name."""
    base = slugify(data.name)
    slug = base
    suffix = 2
    while workspace_repo.slug_exists(db, slug):
        slug = f"{base}-{suffix}"
        suffix += 1
    return workspace_repo.create(
        db,
        obj_in={
            "name": data.name,
            "slug": slug,
            "description": data.description,
            "owner_id": owner_id,
        },
    )


def get(db: Session, workspace_id: str, user_id: str) -> Workspace:
    """Fetch a workspace; 404 if missing, 403 if not owned by the user."""
    workspace = workspace_repo.get(db, workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace not found")
    if workspace.owner_id != user_id:
        raise ForbiddenError("You do not own this workspace")
    return workspace


def update(db: Session, workspace: Workspace, data: WorkspaceUpdate) -> Workspace:
    """Apply a partial update to a workspace."""
    return workspace_repo.update(db, db_obj=workspace, obj_in=data)


def delete(db: Session, workspace: Workspace) -> None:
    """Delete a workspace (projects/documents cascade)."""
    workspace_repo.remove(db, id=workspace.id)
