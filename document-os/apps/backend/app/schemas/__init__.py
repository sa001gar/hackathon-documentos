"""Pydantic DTOs (API contract — keep in sync with docs/API.md)."""
from app.schemas.common import Message
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, RegisterRequest
from app.schemas.user import UserRead, UserSettingsRead, UserSettingsUpdate, UserUpdate
from app.schemas.workspace import WorkspaceCreate, WorkspaceRead, WorkspaceUpdate
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.document import (
    ActivityEntry,
    DocumentCreate,
    DocumentDetail,
    DocumentSummary,
    DocumentUpdate,
    MarkdownResponse,
)
from app.schemas.section import (
    SectionContentUpdate,
    SectionCreate,
    SectionMove,
    SectionRead,
    SectionUpdate,
)
from app.schemas.version import VersionRead
from app.schemas.template import TemplateCreate, TemplateRead, TemplateSectionNode
from app.schemas.ai import (
    AILogRead,
    GenerateDocumentRequest,
    GenerationJobRead,
    RefineRequest,
    RefineResponse,
    ReviewReport,
    SectionGenerateRequest,
    ValidationIssue,
    ValidationReport,
)
from app.schemas.export import ExportRead, ExportRequest
from app.schemas.search import SearchResults

__all__ = [name for name in dir() if not name.startswith("_")]
