"""AIEngine — the ONLY entry point the API layer uses for AI work.

Never call providers from endpoints or services; everything funnels through here.
"""
import time
from datetime import datetime, timezone
from typing import AsyncIterator

from sqlalchemy.orm import Session

from app.ai.agents import (
    ExporterAgent,
    PlannerAgent,
    RefinerAgent,
    ReviewerAgent,
    ValidatorAgent,
    WriterAgent,
)
from app.ai.parsers import clean_markdown_output
from app.ai.prompts import get_prompt, render
from app.ai.providers import aget_provider
from app.ai.schemas import LLMMessage, PlannerOutput, SectionContext
from app.core.errors import AIProviderError, NotFoundError
from app.models import Document, DocumentSection
from app.repositories import document_repo, section_repo
from app.schemas.ai import RefineAction, ReviewReport, ValidationIssue, ValidationReport


def _persist_section_content(
    db: Session, section: DocumentSection, content: str, agent: str, summary: str
) -> DocumentSection:
    """Persist AI-written content (lazy service import keeps layers clean + testable)."""
    from app.services import section_service

    return section_service.update_content(
        db, section, content, source="ai", agent=agent, change_summary=summary
    )


class AIEngine:
    # ---------- context builders ----------

    def _outline(self, db: Session, document_id: str) -> str:
        from app.services import document_service

        sections = document_service.get_sections(db, document_id)
        depth: dict[str | None, int] = {None: 0}
        lines = []
        for s in sections:
            d = depth.get(s.parent_id, 0) + (1 if s.parent_id else 0)
            depth[s.id] = d
            marker = "" if s.content.strip() else "  [empty]"
            lines.append(f"{'  ' * d}- {s.title}{marker}")
        return "\n".join(lines)

    def _section_path(self, section: DocumentSection) -> str:
        parts = [section.title]
        cursor = section.parent
        while cursor is not None:
            parts.append(cursor.title)
            cursor = cursor.parent
        return " > ".join(reversed(parts))

    def _sections_dump(self, db: Session, document_id: str) -> str:
        from app.services import document_service

        parts = []
        for s in document_service.get_sections(db, document_id):
            parts.append(f"SECTION: {s.title}\n{s.content.strip() or '(empty)'}\n")
        return "\n".join(parts)

    def _build_context(
        self,
        db: Session,
        section: DocumentSection,
        instructions: str | None,
        outline: str | None = None,
    ) -> SectionContext:
        from app.services import document_service

        document = document_repo.get(db, section.document_id)
        if document is None:
            raise NotFoundError("Document not found")
        return SectionContext(
            document_title=document.title,
            document_description=document.description or "",
            outline=outline if outline is not None else self._outline(db, document.id),
            section_title=section.title,
            section_path=self._section_path(section),
            brief=section.ai_prompt or "",
            instructions=instructions or "",
        )

    # ---------- public API ----------

    async def plan(
        self,
        db: Session,
        *,
        prompt: str,
        existing_structure: list[dict] | None = None,
        document_id: str | None = None,
    ) -> PlannerOutput:
        return await PlannerAgent(db).plan(
            db, prompt=prompt, existing_structure=existing_structure, document_id=document_id
        )

    async def stream_plan(
        self,
        db: Session,
        *,
        prompt: str,
        document_id: str | None = None,
    ) -> AsyncIterator[tuple[str, object]]:
        """Stream the planner live: yields ("token", str) events, then one
        ("plan", PlannerOutput) event after parsing the accumulated text.

        Streaming removes the 30–120s silent window of the blocking planner
        call — the client sees the outline forming token-by-token.
        """
        from app.repositories import ai_log_repo

        agent = PlannerAgent(db)
        system = render(agent.system_prompt)
        user_prompt = agent.build_user_prompt(prompt, None)
        messages = [LLMMessage(role="system", content=system), LLMMessage(role="user", content=user_prompt)]
        provider = await aget_provider()

        chunks: list[str] = []
        started = time.perf_counter()
        async for token in provider.stream(
            messages, temperature=agent.temperature, max_tokens=agent.max_tokens
        ):
            chunks.append(token)
            yield ("token", token)

        raw = "".join(chunks)
        plan = agent.parse_plan(raw)  # raises AIParseError → caller retries
        ai_log_repo.create_log(
            db,
            document_id=document_id,
            agent="planner",
            action="stream_plan",
            model=getattr(provider, "model", provider.name),
            system_prompt=system[:8000],
            user_prompt=user_prompt[:8000],
            response=raw[:8000],
            latency_ms=int((time.perf_counter() - started) * 1000),
            status="success",
        )
        yield ("plan", plan)

    async def generate_section(
        self, db: Session, *, section_id: str, instructions: str | None = None
    ) -> DocumentSection:
        section = section_repo.get(db, section_id)
        if section is None:
            raise NotFoundError("Section not found")
        section.status = "generating"
        db.add(section)
        db.commit()
        try:
            context = self._build_context(db, section, instructions)
            content = await WriterAgent(db).write(
                db, context=context, document_id=section.document_id, section_id=section.id
            )
            section = _persist_section_content(db, section, content, "writer", "AI generation")
            section.status = "draft"
            db.add(section)
            db.commit()
            db.refresh(section)
            return section
        except Exception:
            section.status = "error"
            db.add(section)
            db.commit()
            raise

    async def stream_section(
        self,
        db: Session,
        *,
        section_id: str,
        instructions: str | None = None,
        outline: str | None = None,
    ) -> AsyncIterator[str]:
        """Yield writer tokens as they arrive; persist the cleaned result at the end.

        `outline` lets batch pipelines (full-document generation) compute the
        document outline ONCE and share it across every section — otherwise
        each section re-queries and re-renders the outline (N+1).
        """
        from app.repositories import ai_log_repo

        section = section_repo.get(db, section_id)
        if section is None:
            raise NotFoundError("Section not found")
        section.status = "generating"
        db.add(section)
        db.commit()

        context = self._build_context(db, section, instructions, outline)
        agent = WriterAgent(db)
        system = render(agent.system_prompt)
        user_prompt = agent.build_user_prompt(context)
        messages = [LLMMessage(role="system", content=system), LLMMessage(role="user", content=user_prompt)]
        provider = await aget_provider()

        chunks: list[str] = []
        try:
            async for token in provider.stream(
                messages, temperature=agent.temperature, max_tokens=agent.max_tokens
            ):
                chunks.append(token)
                yield token
        except AIProviderError:
            section.status = "error"
            db.add(section)
            db.commit()
            raise

        content = clean_markdown_output("".join(chunks))
        _persist_section_content(db, section, content, "writer", "AI streaming generation")
        section.status = "draft"
        db.add(section)
        db.commit()
        ai_log_repo.create_log(
            db,
            document_id=section.document_id,
            section_id=section.id,
            agent="writer",
            action="stream",
            model=getattr(provider, "model", provider.name),
            system_prompt=system[:8000],
            user_prompt=user_prompt[:8000],
            response=content[:8000],
            latency_ms=0,
            status="success",
        )

    async def refine(
        self,
        db: Session,
        *,
        section_id: str,
        action: RefineAction,
        selected_text: str,
        instruction: str | None = None,
    ) -> str:
        section = section_repo.get(db, section_id)
        if section is None:
            raise NotFoundError("Section not found")
        document = document_repo.get(db, section.document_id)
        return await RefinerAgent(db).refine(
            db,
            action=action,
            selected_text=selected_text,
            instruction=instruction,
            doc_title=document.title if document else "",
            section_title=section.title,
            document_id=section.document_id,
            section_id=section.id,
        )

    async def validate_document(self, db: Session, *, document_id: str) -> ValidationReport:
        from app.services import document_service

        document = document_service.get(db, document_id)
        is_valid, summary, raw_issues = await ValidatorAgent(db).validate(
            db,
            doc_title=document.title,
            outline=self._outline(db, document_id),
            sections_dump=self._sections_dump(db, document_id),
            document_id=document_id,
        )
        sections = document_service.get_sections(db, document_id)
        by_title = {s.title.strip().lower(): s for s in sections}
        issues: list[ValidationIssue] = []
        for raw in raw_issues:
            title = (raw.get("section_title") or "").strip().lower()
            section = by_title.get(title)
            issue = ValidationIssue(
                type=str(raw.get("type", "structure")),
                severity=str(raw.get("severity", "info")),
                message=str(raw.get("message", "")),
                section_id=section.id if section else None,
                suggestion=raw.get("suggestion"),
            )
            issues.append(issue)
            if section is not None and issue.severity != "error":
                section.status = "validated"
                db.add(section)
        if is_valid:
            document.status = "validated"
            db.add(document)
        db.commit()
        return ValidationReport(
            is_valid=is_valid,
            summary=summary,
            issues=issues,
            checked_at=datetime.now(timezone.utc),
        )

    async def review_document(self, db: Session, *, document_id: str) -> ReviewReport:
        from app.services import document_service

        document = document_service.get(db, document_id)
        report = await ReviewerAgent(db).review(
            db,
            doc_title=document.title,
            outline=self._outline(db, document_id),
            sections_dump=self._sections_dump(db, document_id),
            document_id=document_id,
        )
        document.status = "reviewed"
        db.add(document)
        db.commit()
        return report

    async def executive_summary(self, db: Session, *, document_id: str) -> str:
        from app.services import document_service

        document = document_service.get(db, document_id)
        return await ExporterAgent(db).summarize(
            db,
            doc_title=document.title,
            outline=self._outline(db, document_id),
            sections_dump=self._sections_dump(db, document_id),
            document_id=document_id,
        )


_engine = AIEngine()


def get_ai_engine() -> AIEngine:
    return _engine
