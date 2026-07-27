"""Explainability API — provenance tracking for AI runs."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.explainability import get_explainability

router = APIRouter(tags=["explainability"])


@router.get("/runs/{log_id}")
def get_ai_run_provenance(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full provenance for a specific AI run."""
    return get_explainability(db, log_id=log_id)


@router.get("/document/{document_id}/runs")
def get_document_ai_runs(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all AI runs for a document."""
    return get_explainability(db, document_id=document_id)
