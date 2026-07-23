from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    parent_id: str | None = None
    order_index: int | None = Field(default=None, ge=0)
    content: str | None = None


class SectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    order_index: int | None = Field(default=None, ge=0)
    status: str | None = Field(
        default=None, pattern="^(pending|generating|draft|reviewed|validated|error)$"
    )


class SectionContentUpdate(BaseModel):
    content: str
    source: str = Field(default="manual", pattern="^(manual|ai|restore)$")
    change_summary: str | None = Field(default=None, max_length=512)
    agent: str | None = Field(default=None, max_length=64)


class SectionMove(BaseModel):
    parent_id: str | None = None
    order_index: int = Field(ge=0)


class SectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    parent_id: str | None
    title: str
    content: str
    order_index: int
    status: str
    ai_prompt: str | None
    word_count: int
    metadata: dict = Field(default_factory=dict, validation_alias="meta")
    created_at: datetime
    updated_at: datetime
