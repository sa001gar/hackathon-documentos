"""Document / section / version schemas."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Documents ----------

class DocumentCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    doc_type: str = "general"
    template_id: str | None = None
    original_prompt: str = ""
    plan: "PlanNode | None" = None  # optional planner output to materialize


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(
        default=None, pattern="^(draft|generating|review|final)$"
    )


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    template_id: str | None
    title: str
    description: str
    doc_type: str
    status: str
    original_prompt: str
    meta: dict
    created_at: datetime
    updated_at: datetime


# ---------- Sections ----------

class SectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    parent_id: str | None = None
    order_index: int | None = None
    ai_prompt: str = ""


class SectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    order_index: int | None = None
    # base_updated_at enables optimistic conflict detection for autosave
    base_updated_at: datetime | None = None
    source: Literal["manual", "ai"] = "manual"
    change_summary: str = ""


class SectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    parent_id: str | None
    title: str
    content: str
    order_index: int
    depth: int
    status: str
    ai_prompt: str
    meta: dict
    created_at: datetime
    updated_at: datetime
    children: list["SectionOut"] = []


class DocumentDetail(DocumentOut):
    sections: list[SectionOut] = []


# ---------- Versions ----------

class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    section_id: str
    version_number: int
    source: str
    change_summary: str
    created_at: datetime


class VersionDetail(VersionOut):
    content: str


class DiffLine(BaseModel):
    type: Literal["equal", "add", "remove"]
    text: str


class VersionCompareOut(BaseModel):
    section_id: str
    from_version: int
    to_version: int
    lines: list[DiffLine]


# Late import to avoid circular reference with ai schemas
from app.schemas.ai import PlanNode  # noqa: E402

DocumentCreate.model_rebuild()
SectionOut.model_rebuild()
