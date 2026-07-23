"""Document / section / version repositories."""
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentSection, DocumentVersion, Project, Workspace
from app.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    model = Document

    def for_project(self, project_id: str) -> list[Document]:
        stmt = (
            select(Document)
            .where(Document.project_id == project_id)
            .order_by(Document.updated_at.desc())
        )
        return list(self.db.scalars(stmt))

    def owned_by(self, document_id: str, user_id: str) -> Document | None:
        """Fetch a document only if it belongs to a workspace owned by the user."""
        stmt = (
            select(Document)
            .join(Project, Document.project_id == Project.id)
            .join(Workspace, Project.workspace_id == Workspace.id)
            .where(Document.id == document_id, Workspace.owner_id == user_id)
        )
        return self.db.scalar(stmt)

    def search(self, user_id: str, query: str, limit: int = 10) -> list[Document]:
        pattern = f"%{query}%"
        stmt = (
            select(Document)
            .join(Project, Document.project_id == Project.id)
            .join(Workspace, Project.workspace_id == Workspace.id)
            .where(Workspace.owner_id == user_id)
            .where(or_(Document.title.ilike(pattern), Document.description.ilike(pattern)))
            .limit(limit)
        )
        return list(self.db.scalars(stmt))

    def recent(self, user_id: str, limit: int = 8) -> list[Document]:
        stmt = (
            select(Document)
            .join(Project, Document.project_id == Project.id)
            .join(Workspace, Project.workspace_id == Workspace.id)
            .where(Workspace.owner_id == user_id)
            .order_by(Document.updated_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))


class SectionRepository(BaseRepository[DocumentSection]):
    model = DocumentSection

    def roots_for_document(self, document_id: str) -> list[DocumentSection]:
        stmt = (
            select(DocumentSection)
            .where(
                DocumentSection.document_id == document_id,
                DocumentSection.parent_id.is_(None),
            )
            .order_by(DocumentSection.order_index)
        )
        return list(self.db.scalars(stmt))

    def next_order_index(self, document_id: str, parent_id: str | None) -> int:
        stmt = select(func.coalesce(func.max(DocumentSection.order_index), -1)).where(
            DocumentSection.document_id == document_id,
            DocumentSection.parent_id.is_(None) if parent_id is None
            else DocumentSection.parent_id == parent_id,
        )
        return int(self.db.scalar(stmt) or 0) + 1

    def search(self, user_id: str, query: str, limit: int = 15) -> list[tuple[DocumentSection, Document]]:
        pattern = f"%{query}%"
        stmt = (
            select(DocumentSection, Document)
            .join(Document, DocumentSection.document_id == Document.id)
            .join(Project, Document.project_id == Project.id)
            .join(Workspace, Project.workspace_id == Workspace.id)
            .where(Workspace.owner_id == user_id)
            .where(or_(
                DocumentSection.title.ilike(pattern),
                DocumentSection.content.ilike(pattern),
            ))
            .limit(limit)
        )
        return [(row[0], row[1]) for row in self.db.execute(stmt).all()]


class VersionRepository(BaseRepository[DocumentVersion]):
    model = DocumentVersion

    def for_section(self, section_id: str) -> list[DocumentVersion]:
        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.section_id == section_id)
            .order_by(DocumentVersion.version_number.desc())
        )
        return list(self.db.scalars(stmt))

    def get_by_number(self, section_id: str, number: int) -> DocumentVersion | None:
        stmt = select(DocumentVersion).where(
            DocumentVersion.section_id == section_id,
            DocumentVersion.version_number == number,
        )
        return self.db.scalar(stmt)

    def next_number(self, section_id: str) -> int:
        stmt = select(func.coalesce(func.max(DocumentVersion.version_number), 0)).where(
            DocumentVersion.section_id == section_id
        )
        return int(self.db.scalar(stmt) or 0) + 1
