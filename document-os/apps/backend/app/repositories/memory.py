"""Memory repository: scoped persistent memory with semantic retrieval."""
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.memory import MemoryItem
from app.repositories.base import BaseRepository

MEMORY_SCOPES = ("user", "project", "workspace", "organization")


class MemoryRepository(BaseRepository[MemoryItem]):
    def get_by_scope(self, db: Session, scope: str, scope_id: str, category: str | None = None) -> list[MemoryItem]:
        q = db.query(MemoryItem).filter(
            MemoryItem.scope == scope,
            MemoryItem.scope_id == scope_id,
        )
        if category:
            q = q.filter(MemoryItem.category == category)
        return q.order_by(MemoryItem.created_at.desc()).all()

    def get_by_key(self, db: Session, scope: str, scope_id: str, key: str) -> MemoryItem | None:
        return db.query(MemoryItem).filter(
            MemoryItem.scope == scope,
            MemoryItem.scope_id == scope_id,
            MemoryItem.key == key,
        ).first()

    def search_semantic(self, db: Session, query: str, scope: str | None = None, scope_id: str | None = None, limit: int = 10) -> list[MemoryItem]:
        q = db.query(MemoryItem)
        if scope:
            q = q.filter(MemoryItem.scope == scope)
        if scope_id:
            q = q.filter(MemoryItem.scope_id == scope_id)
        like = f"%{query}%"
        q = q.filter(MemoryItem.content.ilike(like))
        return q.order_by(MemoryItem.confidence.desc()).limit(limit).all()

    def delete_for_scope(self, db: Session, scope: str, scope_id: str) -> None:
        db.query(MemoryItem).filter(
            MemoryItem.scope == scope,
            MemoryItem.scope_id == scope_id,
        ).delete()
        db.commit()


memory_repo = MemoryRepository(MemoryItem)
