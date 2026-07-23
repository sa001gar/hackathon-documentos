"""Workspace & project service."""
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Project, User
from app.repositories import ProjectRepository, WorkspaceRepository
from app.schemas.misc import ProjectCreate, ProjectOut, WorkspaceOut
from app.services.activity import log_activity


class ProjectService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.workspaces = WorkspaceRepository(db)
        self.projects = ProjectRepository(db)

    def list_workspaces(self, user: User) -> list[WorkspaceOut]:
        return [WorkspaceOut.model_validate(w) for w in self.workspaces.for_user(user.id)]

    def list_projects(self, user: User) -> list[ProjectOut]:
        out: list[ProjectOut] = []
        for workspace in self.workspaces.for_user(user.id):
            for project, count in self.projects.for_workspace(workspace.id):
                dto = ProjectOut.model_validate(project)
                dto.document_count = count
                out.append(dto)
        return out

    def create_project(self, user: User, data: ProjectCreate) -> ProjectOut:
        workspaces = self.workspaces.for_user(user.id)
        if not workspaces:
            raise NotFoundError("No workspace found for user")
        project = Project(
            workspace_id=workspaces[0].id, name=data.name, description=data.description
        )
        self.projects.add(project)
        log_activity(self.db, user.id, "project.created", "project", project.id, name=project.name)
        self.db.commit()
        dto = ProjectOut.model_validate(project)
        dto.document_count = 0
        return dto

    def get_project_or_404(self, user: User, project_id: str) -> Project:
        project = self.projects.get(project_id)
        if not project or project.workspace.owner_id != user.id:
            raise NotFoundError("Project not found")
        return project
