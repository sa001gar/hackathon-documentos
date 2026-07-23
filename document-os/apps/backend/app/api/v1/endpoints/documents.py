from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.ai import JobOut
from app.schemas.documents import (
    DocumentCreate,
    DocumentDetail,
    DocumentOut,
    DocumentUpdate,
    SectionCreate,
    SectionOut,
)
from app.services.documents import DocumentService
from app.services.generation import GenerationService

router = APIRouter()


@router.get("/recent", response_model=list[DocumentOut])
def recent_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return DocumentService(db).recent(user)


@router.post("", response_model=DocumentDetail, status_code=201)
def create_document(
    data: DocumentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).create(user, data)


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).detail(user, document_id)


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: str,
    data: DocumentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).update(user, document_id, data)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    DocumentService(db).delete(user, document_id)


@router.post("/{document_id}/sections", response_model=SectionOut, status_code=201)
def create_section(
    document_id: str,
    data: SectionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).create_section(user, document_id, data)


@router.post("/{document_id}/generate", response_model=JobOut, status_code=202)
def generate_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start (or restart) the section-by-section generation pipeline."""
    return GenerationService(db).start_for_document(user, document_id)


@router.get("/{document_id}/job", response_model=JobOut | None)
def latest_job(
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return GenerationService(db).latest_for_document(user, document_id)
