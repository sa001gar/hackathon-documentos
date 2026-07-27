"""Memory API endpoints — persistent user/project/org memory."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.memory import MemoryItemCreate, MemoryItemRead, MemoryItemUpdate
from app.services.memory_service import (
    delete_memory,
    get_memory,
    get_scope_memories,
    search_memory,
    store_memory,
    update_memory,
)

router = APIRouter(tags=["memory"])


@router.post("", response_model=MemoryItemRead, status_code=201)
def create_memory(
    data: MemoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return store_memory(db, data)


@router.get("/{memory_id}", response_model=MemoryItemRead)
def get_memory_item(
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_memory(db, memory_id)


@router.patch("/{memory_id}", response_model=MemoryItemRead)
def patch_memory(
    memory_id: str,
    data: MemoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_memory(db, memory_id, data)


@router.delete("/{memory_id}", status_code=204)
def remove_memory(
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delete_memory(db, memory_id)


@router.get("/scope/{scope}/{scope_id}", response_model=list[MemoryItemRead])
def get_memories_by_scope(
    scope: str,
    scope_id: str,
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scope_memories(db, scope, scope_id, category)


@router.get("/search", response_model=list[MemoryItemRead])
def search_memories(
    q: str,
    scope: str | None = None,
    scope_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return search_memory(db, q, scope, scope_id)
