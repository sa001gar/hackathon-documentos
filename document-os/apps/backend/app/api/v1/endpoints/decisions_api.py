"""Decision Intelligence API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.decision import DecisionCreate, DecisionRead, DecisionUpdate
from app.services.decision_service import (
    create_decision,
    get_decision,
    get_project_decisions,
    get_workspace_decisions,
    search_decisions,
    update_decision,
)

router = APIRouter(tags=["decisions"])


@router.post("", response_model=DecisionRead, status_code=201)
def create_decision_api(
    data: DecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_decision(db, data, current_user.id)


@router.get("/{decision_id}", response_model=DecisionRead)
def get_decision_api(
    decision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_decision(db, decision_id)


@router.patch("/{decision_id}", response_model=DecisionRead)
def patch_decision(
    decision_id: str,
    data: DecisionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_decision(db, decision_id, data)


@router.get("/project/{project_id}", response_model=list[DecisionRead])
def list_project_decisions(
    project_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_project_decisions(db, project_id, limit)


@router.get("/workspace/{workspace_id}", response_model=list[DecisionRead])
def list_workspace_decisions(
    workspace_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_workspace_decisions(db, workspace_id, limit)


@router.get("/search", response_model=list[DecisionRead])
def search_decisions_api(
    q: str,
    workspace_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return search_decisions(db, q, workspace_id)
