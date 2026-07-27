"""SQLAlchemy models. Import everything so Base.metadata is complete."""
from app.models.user import User, UserSettings
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.document import Document
from app.models.section import DocumentSection
from app.models.version import DocumentVersion
from app.models.template import Template
from app.models.ai import AIPrompt, AILog, GenerationJob
from app.models.export import Export
from app.models.knowledge_graph import KGNode, KGEdge
from app.models.memory import MemoryItem
from app.models.decision import Decision

__all__ = [
    "User",
    "UserSettings",
    "Workspace",
    "Project",
    "Document",
    "DocumentSection",
    "DocumentVersion",
    "Template",
    "AIPrompt",
    "AILog",
    "GenerationJob",
    "Export",
    "KGNode",
    "KGEdge",
    "MemoryItem",
    "Decision",
]
