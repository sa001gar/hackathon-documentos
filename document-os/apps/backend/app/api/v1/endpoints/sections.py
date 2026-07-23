from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.ai import GenerateSectionRequest
from app.schemas.documents import (
    SectionOut,
    SectionUpdate,
    VersionCompareOut,
    VersionDetail,
    VersionOut,
)
from app.services.documents import DocumentService
from app.services.generation import GenerationService

router = APIRouter()


@router.patch("/{section_id}", response_model=SectionOut)
def update_section(
    section_id: str,
    data: SectionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Autosave endpoint. Creates a version when content changes.

    Optimistic concurrency: pass base_updated_at to get a 409 on conflicts.
    """
    return DocumentService(db).update_section(user, section_id, data)


@router.delete("/{section_id}", status_code=204)
def delete_section(
    section_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    DocumentService(db).delete_section(user, section_id)


@router.post("/{section_id}/generate", status_code=200)
def regenerate_section(
    section_id: str,
    data: GenerateSectionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Regenerate exactly ONE section with the Writer agent."""
    return GenerationService(db).regenerate_section(user, section_id, data.extra_instructions)


@router.get("/{section_id}/versions", response_model=list[VersionOut])
def list_versions(
    section_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).list_versions(user, section_id)


@router.get("/{section_id}/versions/{number}", response_model=VersionDetail)
def get_version(
    section_id: str,
    number: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).get_version(user, section_id, number)


@router.post("/{section_id}/versions/{number}/restore", response_model=SectionOut)
def restore_version(
    section_id: str,
    number: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).restore_version(user, section_id, number)


@router.get("/{section_id}/compare", response_model=VersionCompareOut)
def compare_versions(
    section_id: str,
    a: int = Query(..., ge=1),
    b: int = Query(..., ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DocumentService(db).compare_versions(user, section_id, a, b)
