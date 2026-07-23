from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.documents import DocumentOut
from app.schemas.misc import ProjectCreate, ProjectOut
from app.services.documents import DocumentService
from app.services.projects import ProjectService

router = APIRouter()


@router.get("", response_model=list[ProjectOut])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ProjectService(db).list_projects(user)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService(db).create_project(user, data)


@router.get("/{project_id}/documents", response_model=list[DocumentOut])
def project_documents(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ProjectService(db).get_project_or_404(user, project_id)
    return DocumentService(db).list_for_project(user, project_id)
