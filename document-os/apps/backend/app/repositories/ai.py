"""Templates, generation jobs, AI logs, exports, activity repositories."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ActivityLog, AILog, Export, GenerationJob, Template
from app.repositories.base import BaseRepository


class TemplateRepository(BaseRepository[Template]):
    model = Template

    def all_visible(self) -> list[Template]:
        stmt = select(Template).order_by(Template.is_builtin.desc(), Template.name)
        return list(self.db.scalars(stmt))

    def search(self, query: str, limit: int = 5) -> list[Template]:
        stmt = select(Template).where(Template.name.ilike(f"%{query}%")).limit(limit)
        return list(self.db.scalars(stmt))


class JobRepository(BaseRepository[GenerationJob]):
    model = GenerationJob

    def latest_for_document(self, document_id: str) -> GenerationJob | None:
        stmt = (
            select(GenerationJob)
            .where(GenerationJob.document_id == document_id)
            .order_by(GenerationJob.created_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)


class AILogRepository(BaseRepository[AILog]):
    model = AILog

    def for_document(self, document_id: str, limit: int = 50) -> list[AILog]:
        stmt = (
            select(AILog)
            .where(AILog.document_id == document_id)
            .order_by(AILog.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))


class ExportRepository(BaseRepository[Export]):
    model = Export

    def for_document(self, document_id: str) -> list[Export]:
        stmt = (
            select(Export)
            .where(Export.document_id == document_id)
            .order_by(Export.created_at.desc())
        )
        return list(self.db.scalars(stmt))


class ActivityRepository(BaseRepository[ActivityLog]):
    model = ActivityLog

    def for_entity(self, entity_id: str, limit: int = 50) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.entity_id == entity_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt))
