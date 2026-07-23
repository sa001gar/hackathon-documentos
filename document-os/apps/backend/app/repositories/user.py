"""User / workspace / project repositories."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Document, Project, User, Workspace
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email.lower()))


class WorkspaceRepository(BaseRepository[Workspace]):
    model = Workspace

    def for_user(self, user_id: str) -> list[Workspace]:
        return list(self.db.scalars(select(Workspace).where(Workspace.owner_id == user_id)))


class ProjectRepository(BaseRepository[Project]):
    model = Project

    def for_workspace(self, workspace_id: str) -> list[tuple[Project, int]]:
        stmt = (
            select(Project, func.count(Document.id).label("doc_count"))
            .outerjoin(Document, Document.project_id == Project.id)
            .where(Project.workspace_id == workspace_id)
            .group_by(Project.id)
            .order_by(Project.created_at)
        )
        return [(row[0], row[1]) for row in self.db.execute(stmt).all()]
