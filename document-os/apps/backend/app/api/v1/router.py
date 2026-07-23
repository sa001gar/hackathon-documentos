from fastapi import APIRouter

from app.api.v1.endpoints import (
    activity,
    ai,
    auth,
    documents,
    exports,
    jobs,
    projects,
    search,
    sections,
    templates,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(sections.router, prefix="/sections", tags=["sections"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(activity.router, prefix="/activity", tags=["activity"])
