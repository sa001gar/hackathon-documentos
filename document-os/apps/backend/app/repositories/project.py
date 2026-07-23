"""Project repository."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def list_for_workspace(self, db: Session, workspace_id: str) -> list[Project]:
        """List projects in a workspace, oldest first."""
        stmt = (
            select(Project)
            .where(Project.workspace_id == workspace_id)
            .order_by(Project.created_at)
        )
        return list(db.scalars(stmt))
