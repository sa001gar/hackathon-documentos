"""Document business logic: CRUD, template materialization, markdown rendering."""
from sqlalchemy.orm import Session, joinedload

from app.core.errors import NotFoundError
from app.models import Document, DocumentSection
from app.repositories import document_repo, section_repo, template_repo
from app.schemas.document import DocumentCreate, DocumentUpdate
from app.utils.markdown import sections_to_markdown


def list_for_project(db: Session, project_id: str) -> list[Document]:
    """List documents in a project (counts are computed by the API layer)."""
    return document_repo.list_for_project(db, project_id)


def create(db: Session, project_id: str, data: DocumentCreate, user_id: str) -> Document:
    """Create a document; materialize the template tree when template_id is given."""
    template = None
    if data.template_id:
        template = template_repo.get(db, data.template_id)
        if template is None:
            raise NotFoundError("Template not found")
    document = document_repo.create(
        db,
        obj_in={
            "project_id": project_id,
            "template_id": data.template_id,
            "title": data.title,
            "description": data.description,
            "created_by": user_id,
        },
    )
    if template is not None:
        _materialize_structure(db, document.id, template.structure, parent_id=None)
    return document


def _materialize_structure(
    db: Session, document_id: str, nodes: list[dict], parent_id: str | None
) -> None:
    """Depth-first creation of template nodes as pending sections."""
    for index, node in enumerate(nodes or []):
        section = section_repo.create(
            db,
            obj_in={
                "document_id": document_id,
                "parent_id": parent_id,
                "title": node.get("title", "Untitled"),
                "order_index": index,
                "ai_prompt": node.get("prompt"),
                "status": "pending",
            },
        )
        _materialize_structure(db, document_id, node.get("children") or [], section.id)


def get(db: Session, document_id: str) -> Document:
    """Fetch a document by id; 404 if missing."""
    document = document_repo.get(db, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    return document


def get_sections(db: Session, document_id: str) -> list[DocumentSection]:
    """Return the document's sections as a flat list in depth-first tree order."""
    sections = section_repo.list_for_document(db, document_id)
    by_parent: dict[str | None, list[DocumentSection]] = {}
    for section in sections:
        by_parent.setdefault(section.parent_id, []).append(section)
    ordered: list[DocumentSection] = []
    def walk(parent_id: str | None) -> None:
        for section in by_parent.get(parent_id, []):
            ordered.append(section)
            walk(section.id)
    walk(None)
    return ordered


def build_section_map(db: Session, document_id: str) -> tuple[dict[str, DocumentSection], list[DocumentSection]]:
    """Return (id→section map, flat ordered list) — preloads parent relationship."""
    from sqlalchemy.orm import joinedload
    sections = (
        db.query(DocumentSection)
        .filter(DocumentSection.document_id == document_id)
        .order_by(DocumentSection.order_index)
        .all()
    )
    by_id: dict[str, DocumentSection] = {}
    for s in sections:
        by_id[s.id] = s
    # Resolve parent references from the loaded map (zero extra queries)
    for s in sections:
        if s.parent_id and s.parent_id in by_id:
            object.__setattr__(s, "parent", by_id[s.parent_id])
    return by_id, sections


def build_outline(sections: list[DocumentSection]) -> str:
    """Build tree outline string from pre-loaded sections — no DB queries."""
    by_parent: dict[str | None, list[DocumentSection]] = {}
    for s in sections:
        by_parent.setdefault(s.parent_id, []).append(s)
    lines: list[str] = []
    def walk(pid: str | None, depth: int = 0) -> None:
        for s in by_parent.get(pid, []):
            marker = "" if s.content.strip() else "  [empty]"
            lines.append(f"{'  ' * depth}- {s.title}{marker}")
            walk(s.id, depth + 1)
    walk(None)
    return "\n".join(lines)


def section_path(section: DocumentSection, section_map: dict[str, DocumentSection]) -> str:
    """Build section path from pre-loaded map — zero DB queries."""
    parts = [section.title]
    cursor_id = section.parent_id
    while cursor_id and cursor_id in section_map:
        parts.append(section_map[cursor_id].title)
        cursor_id = section_map[cursor_id].parent_id
    return " > ".join(reversed(parts))


def section_stats(db: Session, document_id: str) -> tuple[int, int]:
    """Return (section_count, total word_count) for a document."""
    sections = section_repo.list_for_document(db, document_id)
    return len(sections), sum(s.word_count for s in sections)


def update(db: Session, document: Document, data: DocumentUpdate) -> Document:
    """Apply a partial update to a document."""
    return document_repo.update(db, db_obj=document, obj_in=data)


def delete(db: Session, document: Document) -> None:
    """Delete a document (sections/versions/exports cascade)."""
    db.delete(document)
    db.commit()


def full_markdown(db: Session, document_id: str) -> str:
    """Render the whole document as one markdown string with its title."""
    document = get(db, document_id)
    return sections_to_markdown(get_sections(db, document.id), document.title)
