"""AI activity feed for a document (backed by ai_logs)."""
from sqlalchemy.orm import Session

from app.models import AILog
from app.repositories import ai_log_repo


def list_for_document(db: Session, document_id: str, limit: int = 50) -> list[AILog]:
    """List AI log entries for a document, newest first."""
    return ai_log_repo.list_for_document(db, document_id, limit=limit)
