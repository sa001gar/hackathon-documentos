"""Version business logic: history listing and restore."""
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import DocumentSection, DocumentVersion
from app.repositories import version_repo
from app.services import section_service


def list_for_section(db: Session, section_id: str) -> list[DocumentVersion]:
    """List versions of a section, newest first."""
    return version_repo.list_for_section(db, section_id)


def get(db: Session, version_id: str) -> DocumentVersion:
    """Fetch a version by id; 404 if missing."""
    version = version_repo.get(db, version_id)
    if version is None:
        raise NotFoundError("Version not found")
    return version


def restore(db: Session, version_id: str) -> DocumentSection:
    """Restore a version's content; appends a NEW version (history is kept)."""
    version = get(db, version_id)
    section = section_service.get(db, version.section_id)
    return section_service.update_content(
        db,
        section,
        version.content,
        source="restore",
        change_summary=f"Restored version {version.version}",
    )
