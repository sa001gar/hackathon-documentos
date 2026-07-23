"""Search service: projects/documents/sections/templates.

Designed so a semantic (embedding/pgvector) backend can replace the SQL LIKE
implementation behind the same interface later.
"""
import re

from sqlalchemy.orm import Session

from app.models import User
from app.repositories import SectionRepository, TemplateRepository
from app.repositories.document import DocumentRepository
from app.schemas.misc import SearchResultItem, SearchResults


def _snippet(text: str, query: str, width: int = 160) -> str:
    idx = text.lower().find(query.lower())
    if idx == -1:
        return re.sub(r"\s+", " ", text)[:width]
    start = max(idx - 40, 0)
    end = min(idx + width, len(text))
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return prefix + re.sub(r"\s+", " ", text[start:end]).strip() + suffix


class SearchService:
    def __init__(self, db: Session) -> None:
        self.documents = DocumentRepository(db)
        self.sections = SectionRepository(db)
        self.templates = TemplateRepository(db)

    def search(self, user: User, query: str) -> SearchResults:
        items: list[SearchResultItem] = []
        for doc in self.documents.search(user.id, query):
            items.append(SearchResultItem(
                kind="document", id=doc.id, title=doc.title,
                snippet=_snippet(doc.description or doc.title, query),
                document_id=doc.id, document_title=doc.title,
            ))
        for section, doc in self.sections.search(user.id, query):
            items.append(SearchResultItem(
                kind="section", id=section.id, title=section.title,
                snippet=_snippet(section.content or section.title, query),
                document_id=doc.id, document_title=doc.title,
            ))
        for template in self.templates.search(query):
            items.append(SearchResultItem(
                kind="template", id=template.id, title=template.name,
                snippet=template.description,
            ))
        return SearchResults(query=query, items=items)
