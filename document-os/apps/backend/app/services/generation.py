"""Generation pipeline: Planner output -> section-by-section Writer execution.

Design notes:
- Jobs are persisted (generation_jobs table) so generation is resumable.
- Execution runs in a background thread (in-process). The runner interface is
  deliberately small (`run_job(job_id)`) so it can be moved to Celery/Redis
  in production without changing the API.
- Each section is generated independently and versioned (source='ai').
- Every AI call is traced to ai_logs via the engine's log callback.
"""
import logging
import threading

from sqlalchemy.orm import Session

from app.ai.agents import WriterAgent
from app.ai.engine import run_sync
from app.core.errors import ConflictError, NotFoundError
from app.db.session import SessionLocal
from app.models import Document, DocumentSection, DocumentVersion, GenerationJob, User
from app.repositories import JobRepository
from app.schemas.ai import JobOut
from app.services.ai_service import engine_with_logging
from app.services.documents import DocumentService
from app.utils.markdown import breadcrumbs, flatten_sections

logger = logging.getLogger("documentos.generation")

_running: set[str] = set()
_running_lock = threading.Lock()


class GenerationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.jobs = JobRepository(db)
        self.documents = DocumentService(db)

    # ---------------- job lifecycle ----------------

    def start_for_document(self, user: User, document_id: str) -> JobOut:
        doc = self.documents.get_owned(user, document_id)
        roots = [s for s in doc.sections if s.parent_id is None]
        flat = flatten_sections(roots)
        if not flat:
            raise ConflictError("Document has no sections to generate. Create a plan first.")

        existing = self.jobs.latest_for_document(doc.id)
        if existing and existing.status == "running":
            raise ConflictError("A generation job is already running for this document")

        pending = [s for s in flat if s.status in ("pending", "error")]
        job = GenerationJob(
            document_id=doc.id,
            status="pending",
            total_sections=len(pending),
            completed_sections=0,
        )
        self.jobs.add(job)
        doc.status = "generating"
        self.db.commit()
        self._spawn(job.id)
        return JobOut.model_validate(job)

    def resume(self, user: User, job_id: str) -> JobOut:
        job = self._get_owned_job(user, job_id)
        if job.status == "running":
            raise ConflictError("Job is already running")
        roots = [s for s in job.document.sections if s.parent_id is None]
        pending = [s for s in flatten_sections(roots) if s.status in ("pending", "error")]
        job.total_sections = len(pending)
        job.completed_sections = 0
        job.status = "pending"
        job.error = ""
        self.db.commit()
        self._spawn(job.id)
        return JobOut.model_validate(job)

    def cancel(self, user: User, job_id: str) -> JobOut:
        job = self._get_owned_job(user, job_id)
        if job.status in ("pending", "running"):
            job.status = "cancelled"
            self.db.commit()
        return JobOut.model_validate(job)

    def get(self, user: User, job_id: str) -> JobOut:
        return JobOut.model_validate(self._get_owned_job(user, job_id))

    def latest_for_document(self, user: User, document_id: str) -> JobOut | None:
        doc = self.documents.get_owned(user, document_id)
        job = self.jobs.latest_for_document(doc.id)
        return JobOut.model_validate(job) if job else None

    def _get_owned_job(self, user: User, job_id: str) -> GenerationJob:
        job = self.jobs.get(job_id)
        if not job or job.document.project.workspace.owner_id != user.id:
            raise NotFoundError("Job not found")
        return job

    def _spawn(self, job_id: str) -> None:
        with _running_lock:
            if job_id in _running:
                return
            _running.add(job_id)
        thread = threading.Thread(target=_run_job_thread, args=(job_id,), daemon=True)
        thread.start()

    # ---------------- single section regeneration ----------------

    def regenerate_section(
        self, user: User, section_id: str, extra_instructions: str = ""
    ) -> dict:
        section = self.documents.get_section_owned(user, section_id)
        doc = section.document
        section.status = "generating"
        self.db.commit()
        try:
            content = self._write_section(doc, section, extra_instructions)
        except Exception as exc:  # noqa: BLE001
            section.status = "error"
            self.db.commit()
            raise ConflictError(f"Section generation failed: {exc}") from exc
        self._persist_generated(section, content, user.id)
        self.db.commit()
        from app.schemas.documents import SectionOut
        return {"section": SectionOut.model_validate(section)}

    # ---------------- shared writer helpers ----------------

    @staticmethod
    def _write_section(doc: Document, section: DocumentSection, extra: str = "") -> str:
        engine = engine_with_logging()
        agent = WriterAgent(engine)
        by_id = {s.id: s for s in doc.sections}
        return run_sync(agent.run(
            doc_title=doc.title,
            doc_type=doc.doc_type,
            section_title=section.title,
            section_prompt=section.ai_prompt,
            breadcrumb=breadcrumbs(section, by_id),
            extra_instructions=extra,
            document_id=doc.id,
            section_id=section.id,
        ))

    def _persist_generated(self, section: DocumentSection, content: str, user_id: str | None) -> None:
        section.content = content
        section.status = "done"
        next_number = (
            max([v.version_number for v in section.versions], default=0) + 1
        )
        self.db.add(DocumentVersion(
            section_id=section.id,
            document_id=section.document_id,
            version_number=next_number,
            content=content,
            source="ai",
            change_summary="AI generated",
            created_by=user_id,
        ))


def _run_job_thread(job_id: str) -> None:
    """Background worker: generates each pending section sequentially."""
    db: Session = SessionLocal()
    try:
        job = db.get(GenerationJob, job_id)
        if not job or job.status == "cancelled":
            return
        job.status = "running"
        db.commit()

        doc = db.get(Document, job.document_id)
        roots = [s for s in doc.sections if s.parent_id is None]
        queue = [s for s in flatten_sections(roots) if s.status in ("pending", "error")]
        by_id = {s.id: s for s in doc.sections}
        engine = engine_with_logging()
        agent = WriterAgent(engine)

        failures = 0
        for section in queue:
            db.refresh(job)
            if job.status == "cancelled":
                break
            job.current_section_id = section.id
            section.status = "generating"
            db.commit()
            try:
                content = run_sync(agent.run(
                    doc_title=doc.title,
                    doc_type=doc.doc_type,
                    section_title=section.title,
                    section_prompt=section.ai_prompt,
                    breadcrumb=breadcrumbs(section, by_id),
                    document_id=doc.id,
                    section_id=section.id,
                ))
                section.content = content
                section.status = "done"
                next_number = max([v.version_number for v in section.versions], default=0) + 1
                db.add(DocumentVersion(
                    section_id=section.id, document_id=doc.id,
                    version_number=next_number, content=content,
                    source="ai", change_summary="AI generated",
                ))
            except Exception as exc:  # noqa: BLE001 — keep pipeline resumable
                failures += 1
                section.status = "error"
                job.error = f"Section '{section.title}' failed: {exc}"
                logger.exception("Section generation failed: %s", section.title)
            job.completed_sections += 1
            db.commit()

        db.refresh(job)
        if job.status != "cancelled":
            job.status = "failed" if failures and failures == len(queue) else "completed"
            job.current_section_id = None
        if doc.status == "generating":
            doc.status = "draft"
        db.commit()
        logger.info("Job %s finished: %s", job_id, job.status)
    except Exception:  # noqa: BLE001
        logger.exception("Generation job %s crashed", job_id)
        try:
            job = db.get(GenerationJob, job_id)
            if job:
                job.status = "failed"
                job.error = "Internal worker error"
                db.commit()
        except Exception:  # noqa: BLE001
            pass
    finally:
        with _running_lock:
            _running.discard(job_id)
        db.close()
