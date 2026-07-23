"""Workspace repository."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Workspace
from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    def list_for_user(self, db: Session, owner_id: str) -> list[Workspace]:
        """List workspaces owned by a user, oldest first."""
        stmt = (
            select(Workspace)
            .where(Workspace.owner_id == owner_id)
            .order_by(Workspace.created_at)
        )
        return list(db.scalars(stmt))

    def slug_exists(self, db: Session, slug: str) -> bool:
        """Check whether a workspace slug is already taken."""
        stmt = select(Workspace.id).where(Workspace.slug == slug).limit(1)
        return db.scalar(stmt) is not None
