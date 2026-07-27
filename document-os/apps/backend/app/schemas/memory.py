from datetime import datetime
from typing import Any

from pydantic import BaseModel

MEMORY_SCOPES = ("user", "project", "workspace", "organization")


class MemoryItemCreate(BaseModel):
    scope: str
    scope_id: str
    key: str
    value: dict[str, Any] = {}
    content: str = ""
    category: str = "general"
    source: str = "manual"
    confidence: float = 1.0


class MemoryItemRead(BaseModel):
    id: str
    scope: str
    scope_id: str
    key: str
    value: dict[str, Any]
    content: str
    category: str
    source: str
    confidence: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryItemUpdate(BaseModel):
    value: dict[str, Any] | None = None
    content: str | None = None
    confidence: float | None = None


class MemorySearch(BaseModel):
    query: str
    scope: str | None = None
    scope_id: str | None = None
    category: str | None = None
    limit: int = 10
