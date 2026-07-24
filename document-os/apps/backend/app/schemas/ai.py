"""Schemas for AI endpoints (requests + structured agent outputs)."""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class GenerateDocumentRequest(BaseModel):
    prompt: str = Field(default="", max_length=50000)
    use_existing_structure: bool = True


class SectionGenerateRequest(BaseModel):
    instructions: str | None = Field(default=None, max_length=4000)


class RefineAction(str, Enum):
    rewrite = "rewrite"
    improve = "improve"
    expand = "expand"
    shorten = "shorten"
    professional = "professional"
    friendly = "friendly"
    academic = "academic"
    legal = "legal"
    fix_grammar = "fix_grammar"
    summarize = "summarize"
    continue_writing = "continue"
    translate = "translate"


class RefineRequest(BaseModel):
    action: RefineAction
    selected_text: str = Field(min_length=1, max_length=20000)
    instruction: str | None = Field(default=None, max_length=50000)


class RefineResponse(BaseModel):
    refined_text: str
    action: RefineAction


class ValidationIssue(BaseModel):
    type: str  # missing_section|duplicate|terminology|structure|formatting|broken_reference
    severity: str  # error|warning|info
    message: str
    section_id: str | None = None
    suggestion: str | None = None


class ValidationReport(BaseModel):
    is_valid: bool
    summary: str
    issues: list[ValidationIssue]
    checked_at: datetime


class ReviewReport(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    readability: int = Field(ge=0, le=100)
    completeness: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    strengths: list[str]
    suggestions: list[str]
    summary: str


class GenerationJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    status: str
    total_sections: int
    completed_sections: int
    current_section_id: str | None
    error: str | None
    payload: dict
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class AILogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str | None
    section_id: str | None
    agent: str
    action: str
    model: str
    latency_ms: int
    status: str
    error: str | None
    created_at: datetime
