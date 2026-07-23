"""Document templates (builtin + custom)."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.template import TemplateCreate, TemplateRead
from app.services import template_service

router = APIRouter()


@router.get("", response_model=list[TemplateRead])
def list_templates(
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return template_service.list_templates(db, category)


@router.get("/{template_id}", response_model=TemplateRead)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return template_service.get(db, template_id)


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return template_service.create(db, data)
