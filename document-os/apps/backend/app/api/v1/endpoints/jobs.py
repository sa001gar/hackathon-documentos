from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.ai import JobOut
from app.services.generation import GenerationService

router = APIRouter()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return GenerationService(db).get(user, job_id)


@router.post("/{job_id}/resume", response_model=JobOut, status_code=202)
def resume_job(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Resume a failed/cancelled job: only pending/error sections regenerate."""
    return GenerationService(db).resume(user, job_id)


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return GenerationService(db).cancel(user, job_id)
