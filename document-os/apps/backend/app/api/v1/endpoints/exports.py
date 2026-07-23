from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.misc import ExportOut, ExportRequest
from app.services.export import ExportService

router = APIRouter()


@router.post("/documents/{document_id}", response_model=ExportOut, status_code=201)
def export_document(
    document_id: str,
    data: ExportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ExportService(db).export_document(user, document_id, data.format, data.include_toc)


@router.get("/documents/{document_id}", response_model=list[ExportOut])
def list_exports(
    document_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ExportService(db).list_for_document(user, document_id)


@router.get("/{export_id}/download")
def download_export(
    export_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path, media_type = ExportService(db).get_file(user, export_id)
    return FileResponse(path, media_type=media_type, filename=path.name)
