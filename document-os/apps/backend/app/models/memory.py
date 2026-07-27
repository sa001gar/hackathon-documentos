"""Memory layers: user, project, and organization persistent memory."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import UUIDPrimaryKey, utcnow


MEMORY_SCOPES = ("user", "project", "workspace", "organization")


class MemoryItem(UUIDPrimaryKey, Base):
    __tablename__ = "memory_items"

    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(36), nullable=False)
    key: Mapped[str] = mapped_column(String(256), nullable=False)
    value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    category: Mapped[str] = mapped_column(String(128), default="general", nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="manual", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_memory_scope_lookup", "scope", "scope_id", "category"),
        Index("ix_memory_scope_key", "scope", "scope_id", "key"),
        UniqueConstraint("scope", "scope_id", "key", name="uq_memory_key"),
    )
