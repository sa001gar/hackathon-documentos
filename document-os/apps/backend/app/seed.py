"""Seed the database with a demo workspace and rich sample content.

Usage: uv run python -m app.seed
Demo login: demo@documentos.ai / demo1234
"""
from app.db.session import SessionLocal, init_db
from app.repositories import template_repo, user_repo
from app.schemas.document import DocumentCreate
from app.schemas.project import ProjectCreate
from app.schemas.workspace import WorkspaceCreate
from app.services import (
    auth_service,
    document_service,
    project_service,
    section_service,
    template_service,
    workspace_service,
)
from app.schemas.auth import RegisterRequest

DEMO_EMAIL = "demo@documentos.ai"
DEMO_PASSWORD = "demo1234"

PRD_CONTENT: dict[str, str] = {
    "Overview": """The AI Hiring Platform gives early-stage startups a structured, bias-aware
way to source, screen, and close engineering candidates. Hiring teams at small companies
waste roughly 30% of founder time on ad-hoc recruiting; this product turns that into a
repeatable, measurable pipeline.

- Structured pipeline from sourcing to signed offer
- AI screening with cited evidence and human-in-the-loop review
- Interview kits calibrated to role and level
- Analytics on funnel conversion and time-per-hire""",
    "Goals & Success Metrics": """| Goal | Metric | Target |
| --- | --- | --- |
| Reduce founder recruiting load | Hours per hire | < 8h (from ~25h) by Q3 |
| Screening quality | HM accept rate of AI shortlist | ≥ 85% |
| Adoption | Design-partner startups | 10 within 60 days |
| Trust | AI decisions with linked evidence | 100% |""",
    "Core Features": """- **FR-1 (P0)** Multi-channel ingestion: LinkedIn, referrals, inbound forms.
  *Acceptance:* candidate appears in pipeline ≤ 60s after submission.
- **FR-2 (P0)** Resume parsing into a normalized candidate profile.
  *Acceptance:* 95% field accuracy on the standard test corpus.
- **FR-3 (P0)** AI screening against the job rubric with cited evidence per score.
  *Acceptance:* every score links to the resume spans that produced it.
- **FR-4 (P1)** Structured interview kits per role level.
  *Acceptance:* kit generation in < 10s, editable by the interviewer.
- **FR-5 (P1)** Pipeline stages with SLA reminders.
  *Acceptance:* reminder fires when a candidate idles past the stage SLA.
- **FR-6 (P2)** Offer letter export as PDF for e-signature.
  *Acceptance:* pixel-faithful PDF from the approved template.""",
    "Non-Functional Requirements": """- **Performance:** p95 page load < 300ms; screening score delivered < 30s per candidate.
- **Security & privacy:** SOC 2 roadmap; PII encrypted at rest; GDPR deletion within 30 days.
- **Scalability:** 10k candidates per workspace without degradation.
- **Accessibility:** WCAG 2.1 AA across recruiter-facing flows.""",
}


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        if user_repo.get_by_email(db, DEMO_EMAIL) is not None:
            print(f"Seed already applied. Login with {DEMO_EMAIL} / {DEMO_PASSWORD}")
            return

        template_service.seed_builtin_templates(db)

        user = auth_service.register(
            db,
            RegisterRequest(
                email=DEMO_EMAIL, password=DEMO_PASSWORD, full_name="Demo User"
            ),
        )
        workspace = workspace_service.create(
            db, user.id, WorkspaceCreate(name="Acme Product Lab", description="Demo workspace")
        )
        platform = project_service.create(
            db,
            workspace.id,
            ProjectCreate(
                name="Platform", description="Core product documents", color="#6366f1", icon="rocket"
            ),
        )
        research = project_service.create(
            db,
            workspace.id,
            ProjectCreate(
                name="Research", description="Notes and papers", color="#10b981", icon="flask"
            ),
        )

        # PRD document with realistic, versioned content
        prd_template = template_repo.get_by_name(db, "Product Requirements Document (PRD)")
        prd = document_service.create(
            db,
            platform.id,
            DocumentCreate(
                title="AI Hiring Platform — PRD",
                description="Product requirements for the v1 hiring platform",
                template_id=prd_template.id if prd_template else None,
            ),
            user.id,
        )
        for section in document_service.get_sections(db, prd.id):
            content = PRD_CONTENT.get(section.title)
            if content:
                section_service.update_content(
                    db, section, content, source="manual", change_summary="Seed content"
                )

        # API reference (structure only, ready for generation)
        api_template = template_repo.get_by_name(db, "API Documentation")
        document_service.create(
            db,
            platform.id,
            DocumentCreate(
                title="Payments API Reference",
                description="REST API for the payments service",
                template_id=api_template.id if api_template else None,
            ),
            user.id,
        )

        # An empty document in Research for live demos
        document_service.create(
            db,
            research.id,
            DocumentCreate(
                title="LLM Evaluation — Research Notes",
                description="Scratch document for the demo",
            ),
            user.id,
        )

        print("Seed complete.")
        print(f"  Login:    {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print(f"  Workspace: Acme Product Lab (projects: Platform, Research)")
        print(f"  Documents: AI Hiring Platform — PRD (filled), Payments API Reference (outline),")
        print(f"             LLM Evaluation — Research Notes (empty)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
