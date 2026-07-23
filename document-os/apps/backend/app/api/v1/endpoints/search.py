from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.misc import SearchResults
from app.services.search import SearchService

router = APIRouter()


@router.get("", response_model=SearchResults)
def search(
    q: str = Query(..., min_length=2),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SearchService(db).search(user, q)
