from datetime import datetime
from typing import Any

from pydantic import BaseModel

DECISION_STATUSES = ("proposed", "approved", "rejected", "deprecated", "superseded")


class DecisionCreate(BaseModel):
    title: str
    context: str = ""
    decision: str = ""
    rationale: str = ""
    consequences: str = ""
    alternatives: list[dict[str, Any]] = []
    trade_offs: list[dict[str, Any]] = []
    risks: list[dict[str, Any]] = []
    impact: dict[str, Any] = {}
    assumptions: list[str] = []
    tags: list[str] = []
    document_id: str | None = None
    project_id: str | None = None
    workspace_id: str | None = None


class DecisionRead(BaseModel):
    id: str
    title: str
    status: str
    context: str
    decision: str
    rationale: str
    consequences: str
    alternatives: list[dict[str, Any]]
    trade_offs: list[dict[str, Any]]
    risks: list[dict[str, Any]]
    impact: dict[str, Any]
    assumptions: list[str]
    tags: list[str]
    document_id: str | None = None
    project_id: str | None = None
    workspace_id: str | None = None
    created_by: str
    superseded_by: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DecisionUpdate(BaseModel):
    status: str | None = None
    rationale: str | None = None
    consequences: str | None = None
    risks: list[dict[str, Any]] | None = None
    tags: list[str] | None = None
