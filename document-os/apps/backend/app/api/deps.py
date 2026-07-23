"""Shared API dependencies: auth + resource ownership checks."""
import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, UnauthorizedError
from app.core.security import decode_token
from app.db.session import get_db
from app.models import Document, User
from app.repositories import (
    document_repo,
    export_repo,
    generation_job_repo,
    project_repo,
    section_repo,
    user_repo,
    version_repo,
    workspace_repo,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """Resolve the bearer token to an active user."""
    try:
        user_id = decode_token(token, "access")
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc
    user = user_repo.get(db, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid or expired token")
    return user


def get_document_for_user(db: Session, document_id: str, user: User) -> Document:
    """Load a document and verify the user owns its workspace chain."""
    document = document_repo.get(db, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    project = project_repo.get(db, document.project_id)
    workspace = workspace_repo.get(db, project.workspace_id) if project else None
    if workspace is None or workspace.owner_id != user.id:
        raise NotFoundError("Document not found")  # 404, not 403: no existence leak
    return document


def get_section_for_user(db: Session, section_id: str, user: User):
    section = section_repo.get(db, section_id)
    if section is None:
        raise NotFoundError("Section not found")
    get_document_for_user(db, section.document_id, user)
    return section


def get_version_for_user(db: Session, version_id: str, user: User):
    version = version_repo.get(db, version_id)
    if version is None:
        raise NotFoundError("Version not found")
    section = section_repo.get(db, version.section_id)
    if section is None:
        raise NotFoundError("Version not found")
    get_document_for_user(db, section.document_id, user)
    return version


def get_job_for_user(db: Session, job_id: str, user: User):
    job = generation_job_repo.get(db, job_id)
    if job is None:
        raise NotFoundError("Generation job not found")
    get_document_for_user(db, job.document_id, user)
    return job


def get_export_for_user(db: Session, export_id: str, user: User):
    export = export_repo.get(db, export_id)
    if export is None:
        raise NotFoundError("Export not found")
    get_document_for_user(db, export.document_id, user)
    return export
