from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.misc import TemplateCreate, TemplateOut
from app.services.templates import TemplateService

router = APIRouter()


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return TemplateService(db).list()


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    data: TemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return TemplateService(db).create(user, data)


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    return TemplateService(db).get_or_404(template_id)
