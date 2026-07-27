"""Memory service: persistent user/project/org memory with semantic retrieval."""
from sqlalchemy.orm import Session

from app.models.memory import MemoryItem
from app.repositories import memory_repo
from app.schemas.memory import MemoryItemCreate, MemoryItemUpdate


def store_memory(db: Session, data: MemoryItemCreate) -> MemoryItem:
    existing = memory_repo.get_by_key(db, data.scope, data.scope_id, data.key)
    if existing:
        return memory_repo.update(db, db_obj=existing, obj_in={"value": data.value, "content": data.content, "confidence": data.confidence})
    return memory_repo.create(db, obj_in=data.model_dump())


def get_memory(db: Session, memory_id: str) -> MemoryItem | None:
    return memory_repo.get(db, memory_id)


def get_scope_memories(db: Session, scope: str, scope_id: str, category: str | None = None) -> list[MemoryItem]:
    return memory_repo.get_by_scope(db, scope, scope_id, category)


def search_memory(db: Session, query: str, scope: str | None = None, scope_id: str | None = None, limit: int = 10) -> list[MemoryItem]:
    return memory_repo.search_semantic(db, query, scope, scope_id, limit)


def update_memory(db: Session, memory_id: str, data: MemoryItemUpdate) -> MemoryItem | None:
    obj = memory_repo.get(db, memory_id)
    if obj:
        return memory_repo.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))
    return None


def delete_memory(db: Session, memory_id: str) -> None:
    memory_repo.remove(db, id=memory_id)


def build_user_context(db: Session, user_id: str) -> list[MemoryItem]:
    """Build context for a user from all memory scopes."""
    return memory_repo.get_by_scope(db, "user", user_id)


def build_project_context(db: Session, project_id: str) -> list[MemoryItem]:
    return memory_repo.get_by_scope(db, "project", project_id)
