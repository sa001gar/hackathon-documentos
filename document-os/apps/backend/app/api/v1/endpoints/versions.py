"""Section version history: list, view, restore."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_section_for_user, get_version_for_user
from app.db.session import get_db
from app.models import User
from app.schemas.section import SectionRead
from app.schemas.version import VersionRead
from app.services import version_service

router = APIRouter()


@router.get("/sections/{section_id}/versions", response_model=list[VersionRead])
def list_versions(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_section_for_user(db, section_id, current_user)
    return version_service.list_for_section(db, section_id)


@router.get("/versions/{version_id}", response_model=VersionRead)
def get_version(
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_version_for_user(db, version_id, current_user)


@router.post("/versions/{version_id}/restore", response_model=SectionRead)
def restore_version(
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore: appends a NEW version with the old content (history is immutable)."""
    version = get_version_for_user(db, version_id, current_user)
    return version_service.restore(db, version.id)
