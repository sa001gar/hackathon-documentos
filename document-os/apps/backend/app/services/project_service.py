"""Project business logic."""
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Project
from app.repositories import project_repo
from app.schemas.project import ProjectCreate, ProjectUpdate


def list_for_workspace(db: Session, workspace_id: str) -> list[Project]:
    """List projects in a workspace."""
    return project_repo.list_for_workspace(db, workspace_id)


def create(db: Session, workspace_id: str, data: ProjectCreate) -> Project:
    """Create a project inside a workspace."""
    return project_repo.create(
        db,
        obj_in={"workspace_id": workspace_id, **data.model_dump(exclude_none=True)},
    )


def get(db: Session, project_id: str) -> Project:
    """Fetch a project by id; 404 if missing."""
    project = project_repo.get(db, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    return project


def update(db: Session, project: Project, data: ProjectUpdate) -> Project:
    """Apply a partial update to a project."""
    return project_repo.update(db, db_obj=project, obj_in=data)


def delete(db: Session, project: Project) -> None:
    """Delete a project (documents cascade)."""
    db.delete(project)
    db.commit()
