from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.ai import (
    AILogOut,
    PlanRequest,
    PlanResult,
    RefineRequest,
    RefineResult,
    ReviewResult,
    ValidationResult,
)
from app.services.ai_service import AIService

router = APIRouter()


@router.post("/plan", response_model=PlanResult)
def plan(data: PlanRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Planner agent: user prompt -> hierarchical outline JSON."""
    return AIService(db).plan(user, data)


@router.post("/refine", response_model=RefineResult)
def refine(data: RefineRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Refiner agent: transform exactly the selected text."""
    return AIService(db).refine(user, data)


@router.post("/documents/{document_id}/validate", response_model=ValidationResult)
def validate(
    document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return AIService(db).validate_document(user, document_id)


@router.post("/documents/{document_id}/review", response_model=ReviewResult)
def review(
    document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return AIService(db).review_document(user, document_id)


@router.get("/documents/{document_id}/logs", response_model=list[AILogOut])
def ai_logs(
    document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Every AI action is traceable."""
    return AIService(db).list_logs(user, document_id)
