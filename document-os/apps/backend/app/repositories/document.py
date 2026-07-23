"""Document repository."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document
from app.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    def list_for_project(self, db: Session, project_id: str) -> list[Document]:
        """List documents in a project, most recently updated first."""
        stmt = (
            select(Document)
            .where(Document.project_id == project_id)
            .order_by(Document.updated_at.desc())
        )
        return list(db.scalars(stmt))
