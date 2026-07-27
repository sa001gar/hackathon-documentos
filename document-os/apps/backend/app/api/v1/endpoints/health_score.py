"""Knowledge Health Score API endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.knowledge_health import compute_health_score

router = APIRouter(tags=["health-score"])


@router.get("/{workspace_id}")
def get_health_score(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute knowledge health score for a workspace."""
    return compute_health_score(db, workspace_id)
