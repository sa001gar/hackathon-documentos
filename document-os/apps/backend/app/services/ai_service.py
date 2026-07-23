"""AI orchestration service: plan / refine / validate / review / logs.

This is the ONLY service layer that talks to agents; API endpoints never do.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.ai.agents import PlannerAgent, RefinerAgent, ReviewerAgent, ValidatorAgent
from app.ai.engine import GemmaEngine, get_engine, run_sync
from app.core.errors import NotFoundError
from app.db.session import SessionLocal
from app.models import AILog, Document, User
from app.repositories import AILogRepository, TemplateRepository
from app.schemas.ai import (
    AILogOut,
    PlanRequest,
    PlanResult,
    RefineRequest,
    RefineResult,
    ReviewResult,
    ValidationResult,
)
from app.services.documents import DocumentService
from app.utils.markdown import assemble_markdown, flatten_sections


def default_ai_log_callback(entry: dict) -> None:
    """Persist an AI call trace. Uses its own session: safe from any thread."""
    db = SessionLocal()
    try:
        db.add(AILog(**entry))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()


def engine_with_logging() -> GemmaEngine:
    return get_engine(log_callback=default_ai_log_callback)


class AIService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.engine = engine_with_logging()
        self.documents = DocumentService(db)
        self.logs = AILogRepository(db)

    # ---------------- planning ----------------

    def plan(self, user: User, data: PlanRequest) -> PlanResult:
        outline = None
        if data.template_id:
            template = TemplateRepository(self.db).get(data.template_id)
            if not template:
                raise NotFoundError("Template not found")
            outline = template.outline
            if template.doc_type and data.doc_type == "general":
                data.doc_type = template.doc_type
        agent = PlannerAgent(self.engine)
        plan = run_sync(agent.run(
            user_prompt=data.prompt,
            doc_type=data.doc_type,
            template_outline=outline,
            title_hint=data.title_hint,
        ))
        return PlanResult(title=plan.title, sections=plan.sections)

    # ---------------- refinement ----------------

    def refine(self, user: User, data: RefineRequest) -> RefineResult:
        doc_title, section_title = "", ""
        document_id = data.document_id
        if data.section_id:
            section = self.documents.get_section_owned(user, data.section_id)
            section_title = section.title
            document_id = section.document_id
            doc_title = section.document.title
        elif document_id:
            doc = self.documents.get_owned(user, document_id)
            doc_title = doc.title

        agent = RefinerAgent(self.engine)
        refined = run_sync(agent.run(
            text=data.text,
            action=data.action,
            doc_title=doc_title,
            section_title=section_title,
            target_language=data.target_language,
            extra_instructions=data.extra_instructions,
            document_id=document_id,
            section_id=data.section_id,
        ))
        return RefineResult(
            action=data.action, original=data.text, refined=refined,
            provider=self.engine.active_provider_name,
            model=self.engine._provider.model if self.engine._provider else "unknown",
        )

    # ---------------- validation & review ----------------

    def _document_corpus(self, doc: Document) -> tuple[str, list[str], list[str], int, int]:
        roots = [s for s in doc.sections if s.parent_id is None]
        flat = flatten_sections(roots)
        full_md = assemble_markdown(doc.title, roots)
        outline_titles = [s.title for s in flat]
        empty = [s.title for s in flat if not s.content.strip()]
        return full_md, outline_titles, empty, len(flat), len(flat) - len(empty)

    def validate_document(self, user: User, document_id: str) -> ValidationResult:
        doc = self.documents.get_owned(user, document_id)
        full_md, outline_titles, empty, total, _ = self._document_corpus(doc)
        agent = ValidatorAgent(self.engine)
        output = run_sync(agent.run(
            doc_title=doc.title, full_markdown=full_md,
            outline_titles=outline_titles, empty_sections=empty,
            document_id=doc.id,
        ))
        doc.meta = {**doc.meta, "validation": {
            "passed": output.passed,
            "issues": [i.model_dump() for i in output.issues],
            "checked_at": datetime.utcnow().isoformat(),
        }}
        self.db.commit()
        return ValidationResult(
            document_id=doc.id, passed=output.passed,
            issues=output.issues, checked_sections=total,
        )

    def review_document(self, user: User, document_id: str) -> ReviewResult:
        doc = self.documents.get_owned(user, document_id)
        full_md, _, _, total, filled = self._document_corpus(doc)
        agent = ReviewerAgent(self.engine)
        output = run_sync(agent.run(
            doc_title=doc.title, doc_type=doc.doc_type, full_markdown=full_md,
            total_sections=total, filled_sections=filled, document_id=doc.id,
        ))
        doc.meta = {**doc.meta, "review": {
            **output.model_dump(), "reviewed_at": datetime.utcnow().isoformat(),
        }}
        self.db.commit()
        return ReviewResult(document_id=doc.id, **output.model_dump())

    # ---------------- traceability ----------------

    def list_logs(self, user: User, document_id: str) -> list[AILogOut]:
        self.documents.get_owned(user, document_id)
        out = []
        for log in self.logs.for_document(document_id):
            dto = AILogOut.model_validate(log)
            dto.created_at = log.created_at.isoformat()
            out.append(dto)
        return out
