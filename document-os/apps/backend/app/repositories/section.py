"""DocumentSection repository."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DocumentSection
from app.repositories.base import BaseRepository


class SectionRepository(BaseRepository[DocumentSection]):
    def list_for_document(self, db: Session, document_id: str) -> list[DocumentSection]:
        """List all sections of a document ordered by order_index."""
        stmt = (
            select(DocumentSection)
            .where(DocumentSection.document_id == document_id)
            .order_by(DocumentSection.order_index)
        )
        return list(db.scalars(stmt))

    def count_for_document(self, db: Session, document_id: str) -> int:
        """Count sections in a document."""
        stmt = select(func.count(DocumentSection.id)).where(
            DocumentSection.document_id == document_id
        )
        return int(db.scalar(stmt) or 0)

    def delete_subtree(self, db: Session, section: DocumentSection) -> None:
        """Delete a section; descendants and versions cascade (ORM + FK)."""
        db.delete(section)
        db.commit()
