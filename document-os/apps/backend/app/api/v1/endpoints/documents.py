"""Document CRUD, markdown rendering, and AI activity feed."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_document_for_user
from app.db.session import get_db
from app.models import Document, User
from app.schemas.document import (
    ActivityEntry,
    DocumentCreate,
    DocumentDetail,
    DocumentSummary,
    DocumentUpdate,
    MarkdownResponse,
)
from app.services import activity_service, document_service, project_service, workspace_service

router = APIRouter()


def _summary(db: Session, document: Document) -> DocumentSummary:
    count, words = document_service.section_stats(db, document.id)
    return DocumentSummary(
        id=document.id,
        project_id=document.project_id,
        template_id=document.template_id,
        title=document.title,
        description=document.description,
        status=document.status,
        section_count=count,
        word_count=words,
        created_by=document.created_by,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _detail(db: Session, document: Document) -> DocumentDetail:
    sections = document_service.get_sections(db, document.id)
    return DocumentDetail(**_summary(db, document).model_dump(), sections=sections)


def _get_owned_project(db: Session, project_id: str, user: User):
    project = project_service.get(db, project_id)
    workspace_service.get(db, project.workspace_id, user.id)
    return project


@router.get("/projects/{project_id}/documents", response_model=list[DocumentSummary])
def list_documents(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_project(db, project_id, current_user)
    return [_summary(db, d) for d in document_service.list_for_project(db, project_id)]


@router.post(
    "/projects/{project_id}/documents",
    response_model=DocumentDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    project_id: str,
    data: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_project(db, project_id, current_user)
    document = document_service.create(db, project_id, data, current_user.id)
    return _detail(db, document)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_document_for_user(db, document_id, current_user)
    return _detail(db, document)


@router.patch("/documents/{document_id}", response_model=DocumentSummary)
def update_document(
    document_id: str,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_document_for_user(db, document_id, current_user)
    return _summary(db, document_service.update(db, document, data))


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = get_document_for_user(db, document_id, current_user)
    document_service.delete(db, document)


@router.get("/documents/{document_id}/markdown", response_model=MarkdownResponse)
def get_document_markdown(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_document_for_user(db, document_id, current_user)
    return MarkdownResponse(markdown=document_service.full_markdown(db, document_id))


@router.get("/documents/{document_id}/activity", response_model=list[ActivityEntry])
def get_document_activity(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_document_for_user(db, document_id, current_user)
    logs = activity_service.list_for_document(db, document_id, limit=50)
    return [
        ActivityEntry(
            id=log.id,
            agent=log.agent,
            action=log.action,
            status=log.status,
            section_id=log.section_id,
            detail=(
                f"{log.model} · {log.latency_ms}ms"
                + (f" · error: {log.error}" if log.error else "")
            ),
            created_at=log.created_at,
        )
        for log in logs
    ]
