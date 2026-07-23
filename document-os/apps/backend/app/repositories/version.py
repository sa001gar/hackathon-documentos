"""DocumentVersion repository."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DocumentVersion
from app.repositories.base import BaseRepository


class VersionRepository(BaseRepository[DocumentVersion]):
    def list_for_section(self, db: Session, section_id: str) -> list[DocumentVersion]:
        """List versions of a section, newest version number first."""
        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.section_id == section_id)
            .order_by(DocumentVersion.version.desc())
        )
        return list(db.scalars(stmt))

    def latest_number(self, db: Session, section_id: str) -> int:
        """Return the highest version number for a section (0 if none)."""
        stmt = select(func.coalesce(func.max(DocumentVersion.version), 0)).where(
            DocumentVersion.section_id == section_id
        )
        return int(db.scalar(stmt) or 0)
