"""Document model — the root of a hierarchical section tree."""
from sqlalchemy import JSON, Boolean, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin, UUIDPrimaryKey

DOCUMENT_STATUSES = ("draft", "generating", "generated", "validated", "reviewed", "exported")


class Document(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "documents"

    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    template_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
    meta: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (
        Index("ix_documents_project_updated", "project_id", "updated_at"),
    )

    project: Mapped["Project"] = relationship(back_populates="documents")  # noqa: F821
    sections: Mapped[list["DocumentSection"]] = relationship(  # noqa: F821
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentSection.order_index",
    )
