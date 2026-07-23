"""Section business logic: CRUD, content updates with versioning, tree moves."""
from sqlalchemy.orm import Session

from app.core.errors import AppError, NotFoundError
from app.models import DocumentSection, DocumentVersion
from app.repositories import section_repo, version_repo
from app.schemas.section import SectionCreate, SectionUpdate
from app.utils.markdown import count_words


def get(db: Session, section_id: str) -> DocumentSection:
    """Fetch a section by id; 404 if missing."""
    section = section_repo.get(db, section_id)
    if section is None:
        raise NotFoundError("Section not found")
    return section


def create(db: Session, document_id: str, data: SectionCreate) -> DocumentSection:
    """Create a section; append version 1 when initial content is provided."""
    if data.parent_id is not None:
        parent = get(db, data.parent_id)
        if parent.document_id != document_id:
            raise AppError("Parent section belongs to a different document")
    order_index = data.order_index
    if order_index is None:
        order_index = _next_order_index(db, document_id, data.parent_id)
    section = section_repo.create(
        db,
        obj_in={
            "document_id": document_id,
            "parent_id": data.parent_id,
            "title": data.title,
            "order_index": order_index,
            "content": "",
            "status": "pending",
        },
    )
    if data.content:
        section = update_content(db, section, data.content)
    return section


def _next_order_index(db: Session, document_id: str, parent_id: str | None) -> int:
    """Compute the next sibling order index (max sibling order + 1)."""
    siblings = [
        s
        for s in section_repo.list_for_document(db, document_id)
        if s.parent_id == parent_id
    ]
    return max((s.order_index for s in siblings), default=-1) + 1


def update_meta(db: Session, section: DocumentSection, data: SectionUpdate) -> DocumentSection:
    """Apply a partial metadata update (title/order_index/status)."""
    return section_repo.update(db, db_obj=section, obj_in=data)


def update_content(
    db: Session,
    section: DocumentSection,
    content: str,
    source: str = "manual",
    agent: str | None = None,
    change_summary: str | None = None,
) -> DocumentSection:
    """Append a new version and update the section's content in one commit."""
    version = DocumentVersion(
        section_id=section.id,
        version=version_repo.latest_number(db, section.id) + 1,
        content=content,
        source=source,
        agent=agent,
        change_summary=change_summary,
    )
    db.add(version)
    section.content = content
    section.word_count = count_words(content)
    if section.status == "generating":
        pass  # never interrupt an in-flight generation state
    elif section.status in ("pending", "error"):
        section.status = "draft"
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def move(
    db: Session, section: DocumentSection, parent_id: str | None, order_index: int
) -> DocumentSection:
    """Move a section within its document tree (same-document, no cycles)."""
    if parent_id is not None:
        if parent_id == section.id:
            raise AppError("A section cannot be its own parent")
        parent = section_repo.get(db, parent_id)
        if parent is None or parent.document_id != section.document_id:
            raise AppError("Parent section belongs to a different document")
        cursor: DocumentSection | None = parent
        while cursor is not None:
            if cursor.id == section.id:
                raise AppError("Cannot move a section into its own subtree")
            cursor = cursor.parent
    section.parent_id = parent_id
    section.order_index = order_index
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def delete(db: Session, section: DocumentSection) -> None:
    """Delete a section and its whole subtree (sibling order is not compacted)."""
    section_repo.delete_subtree(db, section)
