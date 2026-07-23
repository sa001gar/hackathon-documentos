"""Structured outputs exchanged inside the AI layer (not API DTOs)."""
from pydantic import BaseModel, Field


class PlannerSectionNode(BaseModel):
    title: str
    prompt: str = ""
    children: list["PlannerSectionNode"] = []


PlannerSectionNode.model_rebuild()


class PlannerOutput(BaseModel):
    title: str
    description: str = ""
    sections: list[PlannerSectionNode] = Field(min_length=1)


class AgentRunResult(BaseModel):
    """What every agent run produces (plus logging metadata)."""

    raw_text: str
    model: str
    latency_ms: int


class LLMMessage(BaseModel):
    role: str  # "system" | "user" | "assistant"
    content: str


class LLMResponse(BaseModel):
    text: str
    model: str
    latency_ms: int


class SectionContext(BaseModel):
    """Everything the Writer agent needs to write one section in context."""

    document_title: str
    document_description: str = ""
    outline: str = ""  # indented outline of the whole tree
    section_title: str
    section_path: str = ""  # e.g. "Functional Requirements > Authentication"
    brief: str = ""  # the section's writing brief (ai_prompt)
    instructions: str = ""  # ad-hoc user instructions
