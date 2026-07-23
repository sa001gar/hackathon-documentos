"""DocumentSection — a node in the document tree. Markdown is the source of truth."""
from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin, UUIDPrimaryKey

SECTION_STATUSES = ("pending", "generating", "draft", "reviewed", "validated", "error")


class DocumentSection(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "document_sections"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("document_sections.id", ondelete="CASCADE"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    ai_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meta: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    document: Mapped["Document"] = relationship(back_populates="sections")  # noqa: F821
    children: Mapped[list["DocumentSection"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="DocumentSection.order_index",
    )
    parent: Mapped["DocumentSection | None"] = relationship(
        back_populates="children", remote_side="DocumentSection.id"
    )
    versions: Mapped[list["DocumentVersion"]] = relationship(  # noqa: F821
        back_populates="section", cascade="all, delete-orphan"
    )
