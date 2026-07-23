"""Section CRUD, content saves (versioned), and tree moves."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_document_for_user, get_section_for_user
from app.db.session import get_db
from app.models import User
from app.schemas.section import (
    SectionContentUpdate,
    SectionCreate,
    SectionMove,
    SectionRead,
    SectionUpdate,
)
from app.services import section_service

router = APIRouter()


@router.post(
    "/documents/{document_id}/sections",
    response_model=SectionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_section(
    document_id: str,
    data: SectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_document_for_user(db, document_id, current_user)
    return section_service.create(db, document_id, data)


@router.get("/sections/{section_id}", response_model=SectionRead)
def get_section(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_section_for_user(db, section_id, current_user)


@router.patch("/sections/{section_id}", response_model=SectionRead)
def update_section(
    section_id: str,
    data: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = get_section_for_user(db, section_id, current_user)
    return section_service.update_meta(db, section, data)


@router.put("/sections/{section_id}/content", response_model=SectionRead)
def put_section_content(
    section_id: str,
    data: SectionContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save content — appends an immutable version (manual by default)."""
    section = get_section_for_user(db, section_id, current_user)
    return section_service.update_content(
        db,
        section,
        data.content,
        source=data.source,
        agent=data.agent,
        change_summary=data.change_summary,
    )


@router.post("/sections/{section_id}/move", response_model=SectionRead)
def move_section(
    section_id: str,
    data: SectionMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = get_section_for_user(db, section_id, current_user)
    return section_service.move(db, section, data.parent_id, data.order_index)


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_section(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = get_section_for_user(db, section_id, current_user)
    section_service.delete(db, section)
