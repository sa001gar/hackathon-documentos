"""Activity log helper."""
from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_activity(
    db: Session, user_id: str | None, action: str, entity_type: str, entity_id: str, **meta
) -> None:
    db.add(ActivityLog(
        user_id=user_id, action=action, entity_type=entity_type,
        entity_id=entity_id, meta=meta,
    ))
