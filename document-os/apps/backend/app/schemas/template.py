from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TemplateSectionNode(BaseModel):
    title: str
    prompt: str | None = None
    children: list["TemplateSectionNode"] = []


TemplateSectionNode.model_rebuild()


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str = Field(default="General", max_length=128)
    structure: list[TemplateSectionNode]


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    category: str
    structure: list[TemplateSectionNode]
    is_builtin: bool
    created_at: datetime
