"""Decision Intelligence: architectural decision records with full provenance."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import UUIDPrimaryKey, utcnow


DECISION_STATUSES = ("proposed", "approved", "rejected", "deprecated", "superseded")


class Decision(UUIDPrimaryKey, Base):
    __tablename__ = "decisions"

    title: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="proposed", nullable=False)
    context: Mapped[str] = mapped_column(Text, default="", nullable=False)
    decision: Mapped[str] = mapped_column(Text, default="", nullable=False)
    rationale: Mapped[str] = mapped_column(Text, default="", nullable=False)
    consequences: Mapped[str] = mapped_column(Text, default="", nullable=False)
    alternatives: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    trade_offs: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    risks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    impact: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    assumptions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    document_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), index=True, nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    superseded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_decisions_project", "project_id"),
        Index("ix_decisions_tags", "tags", postgresql_using="gin"),
    )
