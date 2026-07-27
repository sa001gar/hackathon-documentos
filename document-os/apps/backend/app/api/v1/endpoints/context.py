"""Context Engine API — gather context from all sources."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_document_for_user
from app.db.session import get_db
from app.models import User
from app.services.context_engine import build_full_context, get_user_preferences, get_project_knowledge

router = APIRouter(tags=["context"])


@router.get("/")
def get_context(
    project_id: str | None = None,
    workspace_id: str | None = None,
    document_id: str | None = None,
    query: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive context from all memory layers and knowledge graph."""
    return build_full_context(
        db,
        user_id=current_user.id,
        project_id=project_id,
        workspace_id=workspace_id,
        document_id=document_id,
        query=query,
    )


@router.get("/preferences")
def user_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user preferences (writing style, tone, etc.)."""
    return get_user_preferences(db, current_user.id)


@router.get("/project/{project_id}")
def project_context(
    project_id: str,
    key: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get project knowledge context."""
    return get_project_knowledge(db, project_id, key)
