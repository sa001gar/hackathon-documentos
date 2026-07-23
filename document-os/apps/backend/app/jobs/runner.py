"""In-process background generation runner.

Runs the hierarchical pipeline (plan → per-section writer) as asyncio tasks,
tracking progress on generation_jobs. Resumable: interrupted jobs restart from
their first non-completed section. The interface is deliberately small so a
Redis/Celery backend can replace it without touching the API layer.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.session import SessionLocal
from app.models import DocumentSection, GenerationJob
from app.repositories import document_repo, generation_job_repo, section_repo

logger = logging.getLogger("documentos.jobs")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobRunner:
    def __init__(self) -> None:
        self._tasks: dict[str, asyncio.Task] = {}

    # ---------- public API ----------

    def start_document_generation(
        self, document_id: str, prompt: str, use_existing_structure: bool = True
    ) -> GenerationJob:
        """Create a job row and spawn the pipeline task. Call from async context."""
        db = SessionLocal()
        try:
            document = document_repo.get(db, document_id)
            if document is None:
                raise NotFoundError("Document not found")
            job = generation_job_repo.create_job(
                db, document_id, {"prompt": prompt, "use_existing_structure": use_existing_structure}
            )
            document.status = "generating"
            db.add(document)
            db.commit()
        finally:
            db.close()
        self._spawn(job.id, prompt, use_existing_structure)
        return job

    def resume_interrupted(self) -> None:
        """Re-spawn tasks for jobs left pending/running by a previous shutdown."""
        db = SessionLocal()
        try:
            jobs = generation_job_repo.list_interrupted(db)
            for job in jobs:
                payload = job.payload or {}
                logger.info("Resuming generation job %s for document %s", job.id, job.document_id)
                self._spawn(
                    job.id,
                    payload.get("prompt", ""),
                    bool(payload.get("use_existing_structure", True)),
                )
            if jobs:
                logger.info("Resumed %d interrupted generation job(s).", len(jobs))
        finally:
            db.close()

    def cancel(self, job_id: str) -> GenerationJob:
        """Cooperative cancellation: the pipeline checks status between sections."""
        db = SessionLocal()
        try:
            job = generation_job_repo.get(db, job_id)
            if job is None:
                raise NotFoundError("Generation job not found")
            if job.status in ("pending", "running"):
                job.status = "cancelled"
                job.finished_at = _utcnow()
                db.add(job)
                db.commit()
            db.refresh(job)
            return job
        finally:
            db.close()

    def shutdown(self) -> None:
        for task in self._tasks.values():
            task.cancel()
        self._tasks.clear()

    # ---------- pipeline ----------

    def _spawn(self, job_id: str, prompt: str, use_existing_structure: bool) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            logger.warning("No running event loop; job %s will start on next server runtime.", job_id)
            return
        self._tasks[job_id] = loop.create_task(self._run(job_id, prompt, use_existing_structure))

    async def _run(self, job_id: str, prompt: str, use_existing_structure: bool) -> None:
        db = SessionLocal()
        try:
            job = generation_job_repo.get(db, job_id)
            if job is None or job.status == "cancelled":
                return
            job.status = "running"
            job.started_at = job.started_at or _utcnow()
            db.add(job)
            db.commit()

            document_id = job.document_id

            # 1. Plan (if needed) and materialize sections
            from app.ai.engine import get_ai_engine

            engine = get_ai_engine()
            from app.services import document_service

            sections = document_service.get_sections(db, document_id)
            has_structure = any(s.title for s in sections)
            if not has_structure or not use_existing_structure:
                existing = _structure_snapshot(sections) if (has_structure and use_existing_structure) else None
                plan = await engine.plan(
                    db, prompt=prompt or "Write a professional document.",
                    existing_structure=existing, document_id=document_id,
                )
                self._materialize_plan(db, document_id, plan.sections, keep_filled=use_existing_structure)
                job.payload = {**(job.payload or {}), "plan_title": plan.title}
                db.add(job)
                db.commit()

            # 2. Generate each pending/errored section, in tree order
            sections = document_service.get_sections(db, document_id)
            todo = [s for s in sections if s.status in ("pending", "error")]
            job.total_sections = len(todo)
            job.completed_sections = 0
            db.add(job)
            db.commit()

            succeeded = 0
            for section in todo:
                if self._is_cancelled(db, job_id):
                    logger.info("Job %s cancelled.", job_id)
                    return
                db2 = SessionLocal()  # fresh session per section: no shared state across awaits
                try:
                    current = section_repo.get(db2, section.id)
                    if current is None or current.status not in ("pending", "error"):
                        continue
                    self._touch(db2, job_id, current_section_id=section.id)
                    last_error: Exception | None = None
                    from app.core.config import get_settings

                    timeout = get_settings().AI_REQUEST_TIMEOUT * 3
                    for _attempt in range(get_settings().AI_MAX_RETRIES + 1):
                        try:
                            await asyncio.wait_for(
                                engine.generate_section(db2, section_id=section.id),
                                timeout=timeout,
                            )
                            last_error = None
                            break
                        except asyncio.TimeoutError:
                            last_error = TimeoutError(
                                f"Section generation timed out after {timeout}s"
                            )
                            logger.warning("Section %s timed out (%ds).", section.id, timeout)
                        except Exception as exc:  # per-section resilience
                            last_error = exc
                            logger.warning("Section %s generation failed: %s", section.id, exc)
                    if last_error is not None:
                        current.status = "error"
                        db2.add(current)
                        db2.commit()
                        self._touch(db2, job_id, error=str(last_error)[:1000])
                    else:
                        succeeded += 1
                finally:
                    db2.close()
                self._increment(db, job_id)

            # 3. Finalize
            db3 = SessionLocal()
            try:
                job = generation_job_repo.get(db3, job_id)
                document = document_repo.get(db3, document_id)
                if job is not None and job.status != "cancelled":
                    job.status = "completed" if succeeded > 0 or job.total_sections == 0 else "failed"
                    job.finished_at = _utcnow()
                    job.current_section_id = None
                    db3.add(job)
                if document is not None and document.status == "generating":
                    document.status = "generated" if succeeded > 0 else "draft"
                    db3.add(document)
                db3.commit()
            finally:
                db3.close()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # catch-all: mark the job failed, never crash the server
            logger.exception("Generation job %s crashed", job_id)
            try:
                db4 = SessionLocal()
                try:
                    job = generation_job_repo.get(db4, job_id)
                    if job is not None:
                        job.status = "failed"
                        job.error = str(exc)[:1000]
                        job.finished_at = _utcnow()
                        db4.add(job)
                        db4.commit()
                finally:
                    db4.close()
            except Exception:
                logger.exception("Failed to mark job %s as failed", job_id)
        finally:
            db.close()
            self._tasks.pop(job_id, None)

    # ---------- helpers ----------

    def _materialize_plan(self, db: Session, document_id: str, nodes, keep_filled: bool) -> None:
        """Replace empty sections with the planner tree.

        When keep_filled is set, sections that already have content (user-written
        or previously generated) are preserved; everything else is removed before
        materializing the new outline.
        """
        for section in section_repo.list_for_document(db, document_id):
            if section.parent_id is not None:
                continue  # children are removed by their root's cascade
            if keep_filled and section.content.strip():
                continue  # preserve user-written root trees
            section_repo.delete_subtree(db, section)

        def create_nodes(node_list, parent_id):
            for index, node in enumerate(node_list):
                section = DocumentSection(
                    document_id=document_id,
                    parent_id=parent_id,
                    title=node.title,
                    ai_prompt=node.prompt or "",
                    order_index=index,
                    status="pending",
                )
                db.add(section)
                db.commit()
                db.refresh(section)
                create_nodes(node.children, section.id)

        create_nodes(nodes, None)

    def _is_cancelled(self, db: Session, job_id: str) -> bool:
        job = generation_job_repo.get(db, job_id)
        return job is None or job.status == "cancelled"

    def _touch(self, db: Session, job_id: str, **fields) -> None:
        job = generation_job_repo.get(db, job_id)
        if job is None:
            return
        for key, value in fields.items():
            setattr(job, key, value)
        db.add(job)
        db.commit()

    def _increment(self, db: Session, job_id: str) -> None:
        job = generation_job_repo.get(db, job_id)
        if job is None:
            return
        job.completed_sections += 1
        db.add(job)
        db.commit()


def _structure_snapshot(sections: list[DocumentSection]) -> list[dict]:
    """Nested snapshot of an existing tree for the planner prompt."""
    by_parent: dict[str | None, list[DocumentSection]] = {}
    for s in sections:
        by_parent.setdefault(s.parent_id, []).append(s)

    def build(parent_id):
        return [
            {"title": s.title, "prompt": s.ai_prompt or "", "children": build(s.id)}
            for s in by_parent.get(parent_id, [])
        ]

    return build(None)


job_runner = JobRunner()
