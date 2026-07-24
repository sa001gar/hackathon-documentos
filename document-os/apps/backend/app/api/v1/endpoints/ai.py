"""AI endpoints — everything routes through the AIEngine / job runner.

Endpoints never call providers directly (see app/ai).
"""
import asyncio
import json
import logging

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
from app.models import User, DocumentSection
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

logger = logging.getLogger("documentos.ai.generation")

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


@router.post(
    "/documents/{document_id}/generate/stream",
)
async def stream_generate_document(
    document_id: str,
    data: GenerateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE stream: plan → write each section, pushing rich real-time events.

    All DB work uses a dedicated `stream_db` session (not the request session
    `db`) — the request session may be closed by the time the generator yields.

    Resumable: sections already completed (status not pending/error) are
    skipped, so a client can reconnect after a disconnect and continue.
    Cancellable: on client disconnect the in-flight section resets to pending.
    """
    from app.ai.engine import get_ai_engine
    from app.db.session import SessionLocal
    from app.repositories import document_repo, section_repo
    from app.schemas.section import SectionRead
    from app.services import document_service

    get_document_for_user(db, document_id, current_user)

    def sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    async def event_stream():
        import time as _time

        from app.ai.parsers import AIParseError
        from app.core.errors import AIProviderError
        from app.core.config import get_settings

        stream_db = SessionLocal()
        current_section_id: str | None = None
        t0 = _time.perf_counter()
        try:
            engine = get_ai_engine()
            doc = document_repo.get(stream_db, document_id)

            yield sse({"type": "generation_started", "document_id": document_id})

            # 1. Plan — build outline unless we keep the existing structure.
            #    The planner STREAMS (plan_token events) so the client sees the
            #    outline forming within ~1-2s instead of waiting 30-120s for a
            #    blocking completion call.
            sections = document_service.get_sections(stream_db, document_id)
            has_structure = any(s.title for s in sections)
            if not has_structure or not data.use_existing_structure:
                yield sse({"type": "planning_started"})
                plan = None
                last_plan_error: Exception | None = None
                max_attempts = get_settings().AI_MAX_RETRIES + 1
                for attempt in range(max_attempts):
                    try:
                        async for kind, payload in engine.stream_plan(
                            stream_db,
                            prompt=data.prompt or "Write a professional document.",
                            document_id=document_id,
                        ):
                            if kind == "token":
                                yield sse({"type": "plan_token", "value": payload})
                            else:
                                plan = payload
                        break
                    except (AIParseError, AIProviderError) as exc:
                        last_plan_error = exc
                        logger.warning("Planner attempt %d/%d failed: %s", attempt + 1, max_attempts, exc)
                if plan is None:
                    raise AIProviderError(f"Planner failed after {max_attempts} attempts: {last_plan_error}")
                plan_ms = int((_time.perf_counter() - t0) * 1000)
                logger.info("Planner completed in %dms (%d sections)", plan_ms, len(plan.sections))
                for s in section_repo.list_for_document(stream_db, document_id):
                    if s.parent_id is None:
                        section_repo.delete_subtree(stream_db, s)
                _create_sections(stream_db, document_id, plan.sections, None)

            if doc:
                doc.status = "generating"
                stream_db.add(doc)
                stream_db.commit()

            sections = document_service.get_sections(stream_db, document_id)
            todo = [s for s in sections if s.status in ("pending", "error")]
            total = len(todo)

            # Compute the writer's outline context ONCE for the whole run —
            # stream_section would otherwise rebuild it per section (N+1).
            shared_outline = engine._outline(stream_db, document_id)

            # Full outline with statuses — lets the client render placeholders
            # immediately and mark already-completed sections on reconnect.
            yield sse({
                "type": "outline_created",
                "title": doc.title if doc else "",
                "total": total,
                "sections": [
                    {
                        "id": s.id,
                        "title": s.title,
                        "status": "completed" if s.status in ("draft", "reviewed", "validated") else "queued",
                    }
                    for s in sections
                ],
            })

            # 2. Generate each section
            succeeded = 0
            failed = 0
            for index, section in enumerate(todo):
                current_section_id = section.id
                yield sse({
                    "type": "section_started",
                    "section_id": section.id,
                    "title": section.title,
                    "index": index,
                    "total": total,
                })
                try:
                    section_t0 = _time.perf_counter()
                    async for token in engine.stream_section(
                        stream_db, section_id=section.id, outline=shared_outline
                    ):
                        yield sse({"type": "token", "section_id": section.id, "value": token})
                    s = section_repo.get(stream_db, section.id)
                    payload = SectionRead.model_validate(s).model_dump(mode="json")
                    yield sse({"type": "section_completed", "section": payload})
                    succeeded += 1
                    logger.info(
                        "Section %d/%d '%s' written in %dms",
                        index + 1, total, section.title, int((_time.perf_counter() - section_t0) * 1000),
                    )
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    failed += 1
                    s = section_repo.get(stream_db, section.id)
                    if s is not None and s.status == "generating":
                        s.status = "error"
                        stream_db.add(s)
                        stream_db.commit()
                    yield sse({
                        "type": "section_failed",
                        "section_id": section.id,
                        "title": section.title,
                        "message": str(exc)[:500],
                    })
                finally:
                    current_section_id = None

            # 3. Finalize
            if doc:
                doc.status = "generated" if succeeded > 0 else "draft"
                stream_db.add(doc)
                stream_db.commit()

            total_ms = int((_time.perf_counter() - t0) * 1000)
            logger.info(
                "Generation finished: %d/%d sections in %dms (%.1fs/section avg)",
                succeeded, total, total_ms, (total_ms / max(succeeded, 1)) / 1000,
            )
            yield sse({
                "type": "generation_completed",
                "document_id": document_id,
                "total": total,
                "succeeded": succeeded,
                "failed": failed,
                "duration_ms": total_ms,
            })
        except asyncio.CancelledError:
            # Client disconnected: reset in-flight work so a later resume picks up cleanly.
            try:
                if current_section_id:
                    s = section_repo.get(stream_db, current_section_id)
                    if s is not None and s.status == "generating":
                        s.status = "pending"
                        stream_db.add(s)
                d = document_repo.get(stream_db, document_id)
                if d is not None and d.status == "generating":
                    d.status = "draft"
                    stream_db.add(d)
                stream_db.commit()
            except Exception:
                pass
            raise
        except Exception as exc:
            yield sse({"type": "error", "message": str(exc)[:500]})
        finally:
            stream_db.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _create_sections(
    stream_db: Session, document_id: str, nodes, parent_id: str | None
) -> None:
    """Recursively create section rows from planner output nodes."""
    for i, node in enumerate(nodes):
        sec = DocumentSection(
            document_id=document_id,
            parent_id=parent_id,
            title=node.title,
            ai_prompt=node.prompt or "",
            order_index=i,
            status="pending",
        )
        stream_db.add(sec)
        stream_db.commit()
        stream_db.refresh(sec)
        _create_sections(stream_db, document_id, node.children, sec.id)



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
