"""DocumentOS API — application entrypoint."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.db.session import SessionLocal, init_db

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s"
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables
    init_db()
    Path(settings.EXPORT_DIR).mkdir(parents=True, exist_ok=True)

    # Seed builtin templates + prompt registry (idempotent)
    db = SessionLocal()
    try:
        from app.services.template_service import seed_builtin_templates

        seed_builtin_templates(db)

        from app.ai.prompts.loader import seed_prompts_from_files

        seed_prompts_from_files(db)
    finally:
        db.close()

    # Resume any generation jobs interrupted by a shutdown
    from app.jobs.runner import job_runner

    job_runner.resume_interrupted()
    yield
    job_runner.shutdown()


app = FastAPI(
    title="DocumentOS API",
    version="0.1.0",
    description="AI Document Operating System — hierarchical, agent-driven documents powered by Gemma.",
    lifespan=lifespan,
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.router import api_router  # noqa: E402

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health():
    from app.ai.providers import current_provider_name

    return {
        "status": "ok",
        "service": "documentos-api",
        "ai_provider": current_provider_name(),
        "gemma_model": (
            settings.GOOGLE_MODEL
            if (settings.GEMINI_API_KEY and settings.AI_PROVIDER in ("auto", "google"))
            else settings.GEMMA_MODEL
        ),
    }
