"""Workspace-scoped search."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.search import SearchResults
from app.services import search_service, workspace_service

router = APIRouter()


@router.get("", response_model=SearchResults)
def search(
    q: str = Query(min_length=1, max_length=200),
    workspace_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace_service.get(db, workspace_id, current_user.id)  # ownership check
    return search_service.search(db, q, workspace_id)
