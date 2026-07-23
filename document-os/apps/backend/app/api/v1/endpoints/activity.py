from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.repositories import ActivityRepository
from app.schemas.misc import ActivityOut

router = APIRouter()


@router.get("", response_model=list[ActivityOut])
def activity_feed(
    entity_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = user  # entity-level authorization enforced by document/section endpoints
    return ActivityRepository(db).for_entity(entity_id)
