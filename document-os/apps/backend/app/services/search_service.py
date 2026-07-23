"""Workspace-scoped search across projects, documents, and sections.

SQL LIKE-based for portability; the SearchResults shape is designed so a
semantic/vector backend can replace the internals without API changes.
"""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Document, DocumentSection, Project
from app.schemas.search import DocumentHit, ProjectHit, SearchResults, SectionHit
from app.utils.markdown import make_snippet

MAX_PER_GROUP = 10


def search(db: Session, query: str, workspace_id: str) -> SearchResults:
    """Find matching projects, documents, and sections within a workspace."""
    like = f"%{query.strip()}%"

    projects = (
        db.query(Project)
        .filter(Project.workspace_id == workspace_id, Project.name.ilike(like))
        .limit(MAX_PER_GROUP)
        .all()
    )

    documents = (
        db.query(Document)
        .join(Project, Document.project_id == Project.id)
        .filter(
            Project.workspace_id == workspace_id,
            or_(Document.title.ilike(like), Document.description.ilike(like)),
        )
        .limit(MAX_PER_GROUP)
        .all()
    )

    sections = (
        db.query(DocumentSection)
        .join(Document, DocumentSection.document_id == Document.id)
        .join(Project, Document.project_id == Project.id)
        .filter(
            Project.workspace_id == workspace_id,
            or_(DocumentSection.title.ilike(like), DocumentSection.content.ilike(like)),
        )
        .limit(MAX_PER_GROUP)
        .all()
    )

    return SearchResults(
        query=query,
        projects=[ProjectHit(id=p.id, name=p.name) for p in projects],
        documents=[
            DocumentHit(
                id=d.id,
                title=d.title,
                project_id=d.project_id,
                snippet=make_snippet(d.description or d.title, query),
            )
            for d in documents
        ],
        sections=[
            SectionHit(
                id=s.id,
                document_id=s.document_id,
                title=s.title,
                snippet=make_snippet(s.content or s.title, query),
            )
            for s in sections
        ],
    )
