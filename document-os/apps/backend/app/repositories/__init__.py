"""Repositories: data access layer. Singleton instances per entity."""
from app.models import (
    AILog,
    AIPrompt,
    Document,
    DocumentSection,
    DocumentVersion,
    Export,
    GenerationJob,
    Project,
    Template,
    User,
    UserSettings,
    Workspace,
)
from app.repositories.ai import AILogRepository, AIPromptRepository, GenerationJobRepository
from app.repositories.base import BaseRepository
from app.repositories.document import DocumentRepository
from app.repositories.export import ExportRepository
from app.repositories.project import ProjectRepository
from app.repositories.section import SectionRepository
from app.repositories.template import TemplateRepository
from app.repositories.user import UserRepository, UserSettingsRepository
from app.repositories.version import VersionRepository
from app.repositories.workspace import WorkspaceRepository

user_repo = UserRepository(User)
user_settings_repo = UserSettingsRepository(UserSettings)
workspace_repo = WorkspaceRepository(Workspace)
project_repo = ProjectRepository(Project)
document_repo = DocumentRepository(Document)
section_repo = SectionRepository(DocumentSection)
version_repo = VersionRepository(DocumentVersion)
template_repo = TemplateRepository(Template)
ai_prompt_repo = AIPromptRepository(AIPrompt)
ai_log_repo = AILogRepository(AILog)
generation_job_repo = GenerationJobRepository(GenerationJob)
export_repo = ExportRepository(Export)

__all__ = [
    "BaseRepository",
    "UserRepository", "UserSettingsRepository", "WorkspaceRepository",
    "ProjectRepository", "DocumentRepository", "SectionRepository",
    "VersionRepository", "TemplateRepository", "AIPromptRepository",
    "AILogRepository", "GenerationJobRepository", "ExportRepository",
    "user_repo", "user_settings_repo", "workspace_repo", "project_repo",
    "document_repo", "section_repo", "version_repo", "template_repo",
    "ai_prompt_repo", "ai_log_repo", "generation_job_repo", "export_repo",
]
