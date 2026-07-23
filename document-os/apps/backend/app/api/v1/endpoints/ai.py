"""AI endpoints — everything routes through the AIEngine / job runner.

Endpoints never call providers directly (see app/ai).
"""
import json

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_document_for_user,
    get_job_for_user,
    get_section_for_user,
)
from app.db.session import get_db
from app.models import User
from app.schemas.ai import (
    GenerateDocumentRequest,
    GenerationJobRead,
    RefineRequest,
    RefineResponse,
    ReviewReport,
    SectionGenerateRequest,
    ValidationReport,
)
from app.schemas.section import SectionRead

router = APIRouter()


@router.post(
    "/documents/{document_id}/generate",
    response_model=GenerationJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_document(
    document_id: str,
    data: GenerateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kick off hierarchical generation: plan → write each section (background job)."""
    get_document_for_user(db, document_id, current_user)
    from app.jobs.runner import job_runner  # lazy: app.jobs owns its own lifecycle

    return job_runner.start_document_generation(
        document_id, data.prompt, data.use_existing_structure
    )


@router.get("/generation-jobs/{job_id}", response_model=GenerationJobRead)
def get_generation_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_job_for_user(db, job_id, current_user)


@router.post("/generation-jobs/{job_id}/cancel", response_model=GenerationJobRead)
def cancel_generation_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_job_for_user(db, job_id, current_user)
    from app.jobs.runner import job_runner

    return job_runner.cancel(job_id)


@router.post("/sections/{section_id}/generate", response_model=SectionRead)
async def generate_section(
    section_id: str,
    data: SectionGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """(Re)generate exactly one section with the Writer agent."""
    get_section_for_user(db, section_id, current_user)
    from app.ai.engine import get_ai_engine

    return await get_ai_engine().generate_section(
        db, section_id=section_id, instructions=data.instructions
    )


@router.post("/sections/{section_id}/generate/stream")
async def stream_generate_section(
    section_id: str,
    data: SectionGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE token stream for one section's generation."""
    get_section_for_user(db, section_id, current_user)

    async def event_stream():
        from app.ai.engine import get_ai_engine
        from app.db.session import SessionLocal
        from app.repositories import section_repo

        stream_db = SessionLocal()  # dedicated session: the request session is closed by now
        try:
            async for token in get_ai_engine().stream_section(
                stream_db, section_id=section_id, instructions=data.instructions
            ):
                yield f"data: {json.dumps({'type': 'token', 'value': token})}\n\n"
            section = section_repo.get(stream_db, section_id)
            payload = SectionRead.model_validate(section).model_dump(mode="json")
            yield f"data: {json.dumps({'type': 'done', 'section': payload})}\n\n"
        except Exception as exc:  # surface provider failures to the client
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        finally:
            stream_db.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/sections/{section_id}/refine", response_model=RefineResponse)
async def refine_section(
    section_id: str,
    data: RefineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transform only the selected text with the Refiner agent."""
    get_section_for_user(db, section_id, current_user)
    from app.ai.engine import get_ai_engine

    refined = await get_ai_engine().refine(
        db,
        section_id=section_id,
        action=data.action,
        selected_text=data.selected_text,
        instruction=data.instruction,
    )
    return RefineResponse(refined_text=refined, action=data.action)


@router.post("/documents/{document_id}/validate", response_model=ValidationReport)
async def validate_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_document_for_user(db, document_id, current_user)
    from app.ai.engine import get_ai_engine

    return await get_ai_engine().validate_document(db, document_id=document_id)


@router.post("/documents/{document_id}/review", response_model=ReviewReport)
async def review_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_document_for_user(db, document_id, current_user)
    from app.ai.engine import get_ai_engine

    return await get_ai_engine().review_document(db, document_id=document_id)
