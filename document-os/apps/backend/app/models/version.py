"""DocumentVersion — immutable content snapshot of a section."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import UUIDPrimaryKey, utcnow

VERSION_SOURCES = ("manual", "ai", "restore")


class DocumentVersion(UUIDPrimaryKey, Base):
    __tablename__ = "document_versions"

    section_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("document_sections.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    agent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    change_summary: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    section: Mapped["DocumentSection"] = relationship(back_populates="versions")  # noqa: F821
