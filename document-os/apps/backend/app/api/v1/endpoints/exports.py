"""Document export (markdown / html / pdf / docx / json) + download."""
from pathlib import Path

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_document_for_user, get_export_for_user
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models import User
from app.schemas.export import ExportRead, ExportRequest
from app.services import export_service

router = APIRouter()

_MEDIA_TYPES = {
    "markdown": "text/markdown",
    "html": "text/html",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "json": "application/json",
}


@router.post(
    "/documents/{document_id}/export",
    response_model=ExportRead,
    status_code=status.HTTP_201_CREATED,
)
async def export_document(
    document_id: str,
    data: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_document_for_user(db, document_id, current_user)
    summary = None
    if data.include_summary and data.format in ("markdown", "html", "pdf", "docx"):
        from app.ai.engine import get_ai_engine
        from app.core.errors import AIProviderError

        try:
            summary = await get_ai_engine().executive_summary(db, document_id=document_id)
        except AIProviderError:
            summary = None  # export must succeed even if the model is down
    return export_service.export_document(db, document, data.format, summary=summary)


@router.get("/exports/{export_id}/download")
def download_export(
    export_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    export = get_export_for_user(db, export_id, current_user)
    path = Path(export.file_path)
    if not path.is_file():
        raise NotFoundError("Export file is missing on disk")
    return FileResponse(
        path,
        media_type=_MEDIA_TYPES.get(export.format, "application/octet-stream"),
        filename=path.name,
    )
