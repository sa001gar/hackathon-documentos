from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.section import SectionRead


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    template_id: str | None = None


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None
    status: str | None = Field(
        default=None,
        pattern="^(draft|generating|generated|validated|reviewed|exported)$",
    )


class DocumentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    template_id: str | None
    title: str
    description: str | None
    status: str
    section_count: int = 0
    word_count: int = 0
    created_by: str
    created_at: datetime
    updated_at: datetime


class DocumentDetail(DocumentSummary):
    sections: list[SectionRead] = []


class MarkdownResponse(BaseModel):
    markdown: str


class ActivityEntry(BaseModel):
    id: str
    agent: str
    action: str
    status: str
    section_id: str | None
    detail: str | None
    created_at: datetime
