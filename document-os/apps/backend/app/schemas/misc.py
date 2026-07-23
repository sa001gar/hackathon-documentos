"""Projects, workspaces, templates, search, export, activity schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    name: str
    description: str
    created_at: datetime
    document_count: int = 0


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    doc_type: str = "general"
    outline: list[dict] = []


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    doc_type: str
    outline: list
    is_builtin: bool


class SearchResultItem(BaseModel):
    kind: str  # document|section|template
    id: str
    title: str
    snippet: str
    document_id: str | None = None
    document_title: str | None = None


class SearchResults(BaseModel):
    query: str
    items: list[SearchResultItem]


class ExportRequest(BaseModel):
    format: str = Field(pattern="^(md|html|json|docx|pdf)$")
    include_toc: bool = True


class ExportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    format: str
    created_at: datetime
    download_url: str = ""


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str
    entity_type: str
    entity_id: str
    meta: dict
    created_at: datetime
