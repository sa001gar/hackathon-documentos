"""Template repository."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Template
from app.repositories.base import BaseRepository


class TemplateRepository(BaseRepository[Template]):
    def list_all(self, db: Session, category: str | None = None) -> list[Template]:
        """List templates (optionally filtered by category), builtins first."""
        stmt = select(Template)
        if category:
            stmt = stmt.where(Template.category == category)
        stmt = stmt.order_by(Template.is_builtin.desc(), Template.name)
        return list(db.scalars(stmt))

    def get_by_name(self, db: Session, name: str) -> Template | None:
        """Find a template by exact name (builtins win over user templates)."""
        stmt = (
            select(Template)
            .where(Template.name == name)
            .order_by(Template.is_builtin.desc())
            .limit(1)
        )
        return db.scalar(stmt)
