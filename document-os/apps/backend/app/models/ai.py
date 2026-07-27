"""AI-related tables: prompt registry, call logs, generation jobs."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import UUIDPrimaryKey, utcnow

AGENT_NAMES = ("planner", "writer", "refiner", "validator", "reviewer", "exporter")
JOB_STATUSES = ("pending", "running", "completed", "failed", "cancelled")


class AIPrompt(UUIDPrimaryKey, Base):
    """Configurable, versioned prompt templates (seeded from packages/prompts)."""

    __tablename__ = "ai_prompts"
    __table_args__ = (UniqueConstraint("agent", "name", "version", name="uq_prompt_agent_name_version"),)

    agent: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), default="default", nullable=False)
    template: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class AILog(UUIDPrimaryKey, Base):
    """Full trace of every agent call — the backbone of AI traceability."""

    __tablename__ = "ai_logs"

    document_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    section_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    agent: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    model: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)
    user_prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)
    response: Mapped[str] = mapped_column(Text, default="", nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="success", nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_ai_logs_doc_created", "document_id", "created_at"),
    )


class GenerationJob(UUIDPrimaryKey, Base):
    """Tracks hierarchical document generation. Resumable by design."""

    __tablename__ = "generation_jobs"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    total_sections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_sections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_section_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
