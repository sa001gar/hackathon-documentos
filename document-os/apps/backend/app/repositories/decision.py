"""Decision repository: architectural decision records."""
from sqlalchemy.orm import Session

from app.models.decision import Decision
from app.repositories.base import BaseRepository


class DecisionRepository(BaseRepository[Decision]):
    def get_for_project(self, db: Session, project_id: str, limit: int = 50) -> list[Decision]:
        return db.query(Decision).filter(
            Decision.project_id == project_id
        ).order_by(Decision.created_at.desc()).limit(limit).all()

    def get_for_document(self, db: Session, document_id: str) -> list[Decision]:
        return db.query(Decision).filter(
            Decision.document_id == document_id
        ).order_by(Decision.created_at.desc()).all()

    def get_for_workspace(self, db: Session, workspace_id: str, limit: int = 50) -> list[Decision]:
        return db.query(Decision).filter(
            Decision.workspace_id == workspace_id
        ).order_by(Decision.created_at.desc()).limit(limit).all()

    def search(self, db: Session, query: str, workspace_id: str | None = None, limit: int = 20) -> list[Decision]:
        q = db.query(Decision)
        if workspace_id:
            q = q.filter(Decision.workspace_id == workspace_id)
        like = f"%{query}%"
        q = q.filter(
            Decision.title.ilike(like) | Decision.decision.ilike(like) | Decision.rationale.ilike(like)
        )
        return q.order_by(Decision.created_at.desc()).limit(limit).all()


decision_repo = DecisionRepository(Decision)
