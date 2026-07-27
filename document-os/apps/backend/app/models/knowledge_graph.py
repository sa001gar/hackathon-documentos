"""Knowledge Graph: nodes and edges forming the organizational knowledge graph."""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import UUIDPrimaryKey, utcnow


KG_NODE_TYPES = (
    "document", "section", "project", "workspace", "user",
    "requirement", "feature", "decision", "meeting", "note",
    "api", "schema", "database", "frontend", "backend",
    "test", "deployment", "release", "task", "bug",
    "architecture", "compliance_rule", "policy", "brand_guideline",
    "diagram", "code_snippet", "milestone",
)


class KGNode(UUIDPrimaryKey, Base):
    __tablename__ = "kg_nodes"

    label: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    node_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    workspace_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=True)
    document_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="SET NULL"), index=True, nullable=True
    )
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_kg_nodes_type_source", "node_type", "source_id"),
        Index("ix_kg_nodes_ws_type_date", "workspace_id", "node_type", "created_at"),
    )


class KGEdge(UUIDPrimaryKey, Base):
    __tablename__ = "kg_edges"

    source_id: Mapped[str] = mapped_column(String(36), ForeignKey("kg_nodes.id", ondelete="CASCADE"), index=True, nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), ForeignKey("kg_nodes.id", ondelete="CASCADE"), index=True, nullable=False)
    relationship: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_kg_edges_source_rel", "source_id", "relationship"),
        Index("ix_kg_edges_target_rel", "target_id", "relationship"),
        UniqueConstraint("source_id", "target_id", "relationship", name="uq_kg_edge"),
    )
