"""State definitions for LangGraph orchestration workflows."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GraphState:
    """Shared state for the LangGraph orchestration pipeline."""
    user_prompt: str = ""
    document_id: str | None = None
    project_id: str | None = None
    workspace_id: str | None = None
    user_id: str | None = None

    intent: str = ""
    plan: dict | None = None
    context: dict[str, Any] = field(default_factory=dict)
    sections: list[dict] = field(default_factory=list)

    research_results: list[dict] = field(default_factory=list)
    generated_content: str = ""
    compliance_result: dict | None = None
    security_result: dict | None = None
    fact_check_result: dict | None = None
    review_result: dict | None = None
    style_result: dict | None = None

    approved: bool = False
    human_feedback: str = ""
    errors: list[str] = field(default_factory=list)

    workflow_checkpoint_id: str | None = None
    branch_name: str | None = None
    retry_count: int = 0
    max_retries: int = 3

    sources: list[dict] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    confidence: float = 1.0
    requirements_satisfied: list[str] = field(default_factory=list)

    run_metadata: dict[str, Any] = field(default_factory=dict)
