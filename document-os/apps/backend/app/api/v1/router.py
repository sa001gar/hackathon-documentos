"""API v1 router — aggregates every endpoint module."""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    auth,
    documents,
    exports,
    projects,
    search,
    sections,
    templates,
    users,
    versions,
    workspaces,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(documents.router, tags=["documents"])
api_router.include_router(sections.router, tags=["sections"])
api_router.include_router(versions.router, tags=["versions"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(ai.router, tags=["ai"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(exports.router, tags=["exports"])
