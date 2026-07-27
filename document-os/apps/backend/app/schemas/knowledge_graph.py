from datetime import datetime
from typing import Any

from pydantic import BaseModel


class KGNodeCreate(BaseModel):
    label: str
    node_type: str
    source_id: str | None = None
    workspace_id: str | None = None
    project_id: str | None = None
    document_id: str | None = None
    properties: dict[str, Any] = {}
    embedding: list[float] | None = None


class KGNodeRead(BaseModel):
    id: str
    label: str
    node_type: str
    source_id: str | None = None
    workspace_id: str | None = None
    project_id: str | None = None
    document_id: str | None = None
    properties: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KGNodeUpdate(BaseModel):
    label: str | None = None
    properties: dict[str, Any] | None = None


class KGEdgeCreate(BaseModel):
    source_id: str
    target_id: str
    relationship: str
    properties: dict[str, Any] = {}
    weight: float = 1.0


class KGEdgeRead(BaseModel):
    id: str
    source_id: str
    target_id: str
    relationship: str
    properties: dict[str, Any]
    weight: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ImpactPath(BaseModel):
    source: KGNodeRead
    target: KGNodeRead
    relationship: str
    weight: float
    path: list[str]


class ImpactAnalysis(BaseModel):
    node: KGNodeRead
    incoming: list[ImpactPath]
    outgoing: list[ImpactPath]


class GraphQuery(BaseModel):
    query: str
    workspace_id: str | None = None
    limit: int = 20
