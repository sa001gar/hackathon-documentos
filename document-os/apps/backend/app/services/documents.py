"""Document / section / version services.

Core invariants enforced here:
- Documents are hierarchical trees of sections.
- Every content edit creates a version (manual / ai / restore).
- Optimistic concurrency for autosave via base_updated_at.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import (
    Document,
    DocumentSection,
    DocumentVersion,
    User,
)
from app.repositories import (
    DocumentRepository,
    SectionRepository,
    VersionRepository,
)
from app.schemas.ai import PlanNode
from app.schemas.documents import (
    DocumentCreate,
    DocumentDetail,
    DocumentOut,
    DocumentUpdate,
    SectionCreate,
    SectionOut,
    SectionUpdate,
    VersionCompareOut,
    VersionDetail,
    VersionOut,
)
from app.services.activity import log_activity
from app.utils.diff import line_diff


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


class DocumentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.documents = DocumentRepository(db)
        self.sections = SectionRepository(db)
        self.versions = VersionRepository(db)

    # ---------------- documents ----------------

    def list_for_project(self, user: User, project_id: str) -> list[DocumentOut]:
        docs = self.documents.for_project(project_id)
        owned = [d for d in docs if d.project.workspace.owner_id == user.id]
        return [DocumentOut.model_validate(d) for d in owned]

    def recent(self, user: User) -> list[DocumentOut]:
        return [DocumentOut.model_validate(d) for d in self.documents.recent(user.id)]

    def create(self, user: User, data: DocumentCreate) -> DocumentDetail:
        doc = Document(
            project_id=data.project_id,
            template_id=data.template_id,
            title=data.title,
            description=data.description,
            doc_type=data.doc_type,
            original_prompt=data.original_prompt,
            created_by=user.id,
        )
        self.documents.add(doc)
        if data.plan and data.plan.sections:
            self._materialize_plan(doc, data.plan.sections)
        log_activity(self.db, user.id, "document.created", "document", doc.id, title=doc.title)
        self.db.commit()
        return self.detail(user, doc.id)

    def _materialize_plan(
        self, doc: Document, nodes: list[PlanNode], parent: DocumentSection | None = None, depth: int = 0
    ) -> None:
        for index, node in enumerate(nodes):
            section = DocumentSection(
                document_id=doc.id,
                parent_id=parent.id if parent else None,
                title=node.title,
                order_index=index,
                depth=depth,
                status="pending",
                ai_prompt=node.prompt,
            )
            self.sections.add(section)
            if node.children:
                self._materialize_plan(doc, node.children, parent=section, depth=depth + 1)

    def get_owned(self, user: User, document_id: str) -> Document:
        doc = self.documents.owned_by(document_id, user.id)
        if not doc:
            raise NotFoundError("Document not found")
        return doc

    def detail(self, user: User, document_id: str) -> DocumentDetail:
        doc = self.get_owned(user, document_id)
        detail = DocumentDetail.model_validate(doc)
        roots = self.sections.roots_for_document(doc.id)
        detail.sections = [SectionOut.model_validate(s) for s in roots]
        return detail

    def update(self, user: User, document_id: str, data: DocumentUpdate) -> DocumentOut:
        doc = self.get_owned(user, document_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(doc, field, value)
        log_activity(self.db, user.id, "document.updated", "document", doc.id)
        self.db.commit()
        return DocumentOut.model_validate(doc)

    def delete(self, user: User, document_id: str) -> None:
        doc = self.get_owned(user, document_id)
        log_activity(self.db, user.id, "document.deleted", "document", doc.id, title=doc.title)
        self.documents.delete(doc)
        self.db.commit()

    # ---------------- sections ----------------

    def get_section_owned(self, user: User, section_id: str) -> DocumentSection:
        section = self.sections.get(section_id)
        if not section:
            raise NotFoundError("Section not found")
        if section.document.project.workspace.owner_id != user.id:
            raise ForbiddenError("You do not have access to this section")
        return section

    def create_section(self, user: User, document_id: str, data: SectionCreate) -> SectionOut:
        doc = self.get_owned(user, document_id)
        parent = None
        if data.parent_id:
            parent = self.sections.get(data.parent_id)
            if not parent or parent.document_id != doc.id:
                raise NotFoundError("Parent section not found")
        order = data.order_index
        if order is None:
            order = self.sections.next_order_index(doc.id, data.parent_id)
        section = DocumentSection(
            document_id=doc.id,
            parent_id=data.parent_id,
            title=data.title,
            order_index=order,
            depth=(parent.depth + 1) if parent else 0,
            status="pending",
            ai_prompt=data.ai_prompt,
        )
        self.sections.add(section)
        log_activity(self.db, user.id, "section.created", "section", section.id, title=section.title)
        self.db.commit()
        return SectionOut.model_validate(section)

    def update_section(self, user: User, section_id: str, data: SectionUpdate) -> SectionOut:
        section = self.get_section_owned(user, section_id)

        if data.base_updated_at is not None:
            current = _as_utc(section.updated_at)
            base = _as_utc(data.base_updated_at)
            if abs((current - base).total_seconds()) > 1:
                raise ConflictError(
                    "This section changed on the server since you loaded it. Reload to merge."
                )

        content_changed = data.content is not None and data.content != section.content
        if data.title is not None:
            section.title = data.title
        if data.order_index is not None:
            section.order_index = data.order_index
        if content_changed:
            section.content = data.content or ""
            if section.status != "generating":
                section.status = "edited" if data.source == "manual" else "done"
            self._snapshot(section, source=data.source, summary=data.change_summary, user_id=user.id)
        log_activity(self.db, user.id, "section.updated", "section", section.id)
        self.db.commit()
        return SectionOut.model_validate(section)

    def delete_section(self, user: User, section_id: str) -> None:
        section = self.get_section_owned(user, section_id)
        log_activity(self.db, user.id, "section.deleted", "section", section.id, title=section.title)
        self.sections.delete(section)
        self.db.commit()

    # ---------------- versions ----------------

    def _snapshot(
        self, section: DocumentSection, source: str, summary: str, user_id: str | None
    ) -> DocumentVersion:
        version = DocumentVersion(
            section_id=section.id,
            document_id=section.document_id,
            version_number=self.versions.next_number(section.id),
            content=section.content,
            source=source,
            change_summary=summary,
            created_by=user_id,
        )
        self.versions.add(version)
        return version

    def list_versions(self, user: User, section_id: str) -> list[VersionOut]:
        section = self.get_section_owned(user, section_id)
        return [VersionOut.model_validate(v) for v in self.versions.for_section(section.id)]

    def get_version(self, user: User, section_id: str, number: int) -> VersionDetail:
        self.get_section_owned(user, section_id)
        version = self.versions.get_by_number(section_id, number)
        if not version:
            raise NotFoundError("Version not found")
        return VersionDetail.model_validate(version)

    def restore_version(self, user: User, section_id: str, number: int) -> SectionOut:
        section = self.get_section_owned(user, section_id)
        version = self.versions.get_by_number(section_id, number)
        if not version:
            raise NotFoundError("Version not found")
        if version.content != section.content:
            section.content = version.content
            section.status = "edited"
            self._snapshot(
                section, source="restore",
                summary=f"Restored from v{number}", user_id=user.id,
            )
            log_activity(self.db, user.id, "section.restored", "section", section.id, version=number)
            self.db.commit()
        return SectionOut.model_validate(section)

    def compare_versions(self, user: User, section_id: str, a: int, b: int) -> VersionCompareOut:
        self.get_section_owned(user, section_id)
        va = self.versions.get_by_number(section_id, a)
        vb = self.versions.get_by_number(section_id, b)
        if not va or not vb:
            raise NotFoundError("Version not found")
        return VersionCompareOut(
            section_id=section_id, from_version=a, to_version=b,
            lines=line_diff(va.content, vb.content),
        )
