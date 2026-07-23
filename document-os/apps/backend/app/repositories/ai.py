"""AI repositories: prompt registry, call logs, generation jobs."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AILog, AIPrompt, GenerationJob
from app.repositories.base import BaseRepository


class AIPromptRepository(BaseRepository[AIPrompt]):
    def get_active(self, db: Session, agent: str, name: str = "default") -> AIPrompt | None:
        """Return the latest active prompt version for an agent+name pair."""
        stmt = (
            select(AIPrompt)
            .where(
                AIPrompt.agent == agent,
                AIPrompt.name == name,
                AIPrompt.is_active.is_(True),
            )
            .order_by(AIPrompt.version.desc())
            .limit(1)
        )
        return db.scalar(stmt)

    def upsert_version(
        self,
        db: Session,
        agent: str,
        name: str,
        template: str,
        description: str | None,
        temperature: float,
        max_tokens: int,
    ) -> AIPrompt:
        """Insert a new active prompt version, deactivating older ones."""
        stmt = select(func.coalesce(func.max(AIPrompt.version), 0)).where(
            AIPrompt.agent == agent, AIPrompt.name == name
        )
        next_version = int(db.scalar(stmt) or 0) + 1
        db.query(AIPrompt).filter(
            AIPrompt.agent == agent, AIPrompt.name == name
        ).update({"is_active": False})
        prompt = AIPrompt(
            agent=agent,
            name=name,
            template=template,
            description=description,
            temperature=temperature,
            max_tokens=max_tokens,
            version=next_version,
            is_active=True,
        )
        db.add(prompt)
        db.commit()
        db.refresh(prompt)
        return prompt


class AILogRepository(BaseRepository[AILog]):
    def create_log(self, db: Session, **fields) -> AILog:
        """Persist one AI call log entry."""
        return self.create(db, obj_in=fields)

    def list_for_document(self, db: Session, document_id: str, limit: int = 50) -> list[AILog]:
        """List log entries for a document, newest first."""
        stmt = (
            select(AILog)
            .where(AILog.document_id == document_id)
            .order_by(AILog.created_at.desc())
            .limit(limit)
        )
        return list(db.scalars(stmt))


class GenerationJobRepository(BaseRepository[GenerationJob]):
    def create_job(self, db: Session, document_id: str, payload: dict) -> GenerationJob:
        """Create a pending generation job for a document."""
        return self.create(
            db, obj_in={"document_id": document_id, "payload": payload, "status": "pending"}
        )

    def list_interrupted(self, db: Session) -> list[GenerationJob]:
        """List jobs that are still pending or running (resumable on startup)."""
        stmt = (
            select(GenerationJob)
            .where(GenerationJob.status.in_(("pending", "running")))
            .order_by(GenerationJob.created_at)
        )
        return list(db.scalars(stmt))

    def get_latest_for_document(self, db: Session, document_id: str) -> GenerationJob | None:
        """Return the most recent job for a document."""
        stmt = (
            select(GenerationJob)
            .where(GenerationJob.document_id == document_id)
            .order_by(GenerationJob.created_at.desc())
            .limit(1)
        )
        return db.scalar(stmt)
