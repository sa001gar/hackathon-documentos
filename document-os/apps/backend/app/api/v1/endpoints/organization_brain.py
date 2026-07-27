"""Organization Brain API — Q&A over the knowledge graph and memory."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.organization_brain import ask

router = APIRouter(tags=["organization-brain"])


@router.post("/ask")
def ask_brain(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ask a question to the Organization Brain.

    Answers: why was this built, who approved it, what depends on it, etc.
    """
    answer = ask(
        db,
        query=data.get("query", ""),
        workspace_id=data.get("workspace_id"),
    )
    return answer
