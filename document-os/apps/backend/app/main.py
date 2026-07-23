"""DocumentOS backend entrypoint."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.db.session import init_db
from app.services.ai_service import default_ai_log_callback
from app.ai.engine import get_engine
from app.services.templates import seed_builtin_templates
from app.db.session import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("documentos")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    init_db()
    db = SessionLocal()
    try:
        seed_builtin_templates(db)
    finally:
        db.close()
    Path(settings.EXPORT_DIR).mkdir(parents=True, exist_ok=True)
    get_engine(log_callback=default_ai_log_callback)
    logger.info("DocumentOS API ready (provider mode: %s)", settings.AI_PROVIDER)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="DocumentOS API",
        version="0.1.0",
        description="AI Document Operating System — hierarchical, agent-powered documents (Gemma).",
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
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok", "service": "documentos-api"}

    return app


app = create_app()
