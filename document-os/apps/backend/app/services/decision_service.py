"""Decision Intelligence service: architectural decision records."""
from sqlalchemy.orm import Session

from app.models.decision import Decision
from app.repositories import decision_repo
from app.schemas.decision import DecisionCreate, DecisionUpdate


def create_decision(db: Session, data: DecisionCreate, user_id: str) -> Decision:
    return decision_repo.create(db, obj_in={**data.model_dump(), "created_by": user_id})


def get_decision(db: Session, decision_id: str) -> Decision | None:
    return decision_repo.get(db, decision_id)


def update_decision(db: Session, decision_id: str, data: DecisionUpdate) -> Decision | None:
    obj = decision_repo.get(db, decision_id)
    if obj:
        return decision_repo.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))
    return None


def get_project_decisions(db: Session, project_id: str, limit: int = 50) -> list[Decision]:
    return decision_repo.get_for_project(db, project_id, limit)


def get_workspace_decisions(db: Session, workspace_id: str, limit: int = 50) -> list[Decision]:
    return decision_repo.get_for_workspace(db, workspace_id, limit)


def search_decisions(db: Session, query: str, workspace_id: str | None = None, limit: int = 20) -> list[Decision]:
    return decision_repo.search(db, query, workspace_id, limit)
