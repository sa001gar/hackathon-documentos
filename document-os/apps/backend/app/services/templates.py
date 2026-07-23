"""Template service + built-in template catalog (extensible)."""
from sqlalchemy.orm import Session

from app.models import Template, User
from app.repositories import TemplateRepository
from app.schemas.misc import TemplateCreate, TemplateOut

BUILTIN_TEMPLATES: list[dict] = [
    {
        "name": "Product Requirement Document",
        "doc_type": "prd",
        "description": "Define a product or feature: problem, goals, requirements, metrics.",
        "outline": [
            {"title": "Introduction", "prompt": "Introduce the product/feature and the problem it solves."},
            {"title": "Goals and Objectives", "prompt": "List measurable goals and non-goals."},
            {"title": "User Stories and Personas", "prompt": "Describe target personas and key user stories."},
            {"title": "Functional Requirements", "children": [
                {"title": "Core Features", "prompt": "Detail each core feature with acceptance criteria."},
                {"title": "User Flows", "prompt": "Describe primary user flows step by step."},
            ]},
            {"title": "Non-Functional Requirements", "prompt": "Performance, security, scalability, accessibility."},
            {"title": "Success Metrics", "prompt": "Define KPIs and how they are measured."},
            {"title": "Timeline and Milestones", "prompt": "Phased rollout plan with milestones."},
            {"title": "Risks and Open Questions", "prompt": "Known risks, mitigations, unresolved questions."},
        ],
    },
    {
        "name": "Software Requirement Specification",
        "doc_type": "srs",
        "description": "IEEE-style SRS for engineering teams.",
        "outline": [
            {"title": "Introduction", "children": [
                {"title": "Purpose", "prompt": "State the purpose of this SRS."},
                {"title": "Scope", "prompt": "Define the software scope and boundaries."},
                {"title": "Definitions and Acronyms", "prompt": "Define terms and acronyms used."},
            ]},
            {"title": "Overall Description", "prompt": "Product perspective, user classes, assumptions."},
            {"title": "System Features", "prompt": "Enumerate system features with priority and requirements."},
            {"title": "External Interface Requirements", "prompt": "User, hardware, software and communication interfaces."},
            {"title": "Non-Functional Requirements", "prompt": "Performance, safety, security, quality attributes."},
            {"title": "Appendices", "prompt": "Supporting material and references."},
        ],
    },
    {
        "name": "Research Paper",
        "doc_type": "research",
        "description": "Academic structure: abstract, related work, methodology, results.",
        "outline": [
            {"title": "Abstract", "prompt": "150-250 word summary of problem, method, results."},
            {"title": "Introduction", "prompt": "Motivation, problem statement, contributions."},
            {"title": "Related Work", "prompt": "Survey existing approaches and position this work."},
            {"title": "Methodology", "prompt": "Describe the approach, data, and experimental setup."},
            {"title": "Results", "prompt": "Present findings with tables and analysis."},
            {"title": "Discussion", "prompt": "Interpret results, limitations, threats to validity."},
            {"title": "Conclusion and Future Work", "prompt": "Summarize contributions and next steps."},
        ],
    },
    {
        "name": "API Documentation",
        "doc_type": "api",
        "description": "Reference documentation for a REST/GraphQL API.",
        "outline": [
            {"title": "Overview", "prompt": "What the API does, base URL, versioning."},
            {"title": "Authentication", "prompt": "Auth schemes with example requests."},
            {"title": "Endpoints", "children": [
                {"title": "Resources", "prompt": "Document each resource: method, path, params, responses."},
                {"title": "Errors", "prompt": "Error format and status codes."},
            ]},
            {"title": "Rate Limits and Quotas", "prompt": "Limits, headers, best practices."},
            {"title": "SDKs and Examples", "prompt": "Code examples in popular languages."},
        ],
    },
    {
        "name": "Standard Operating Procedure",
        "doc_type": "sop",
        "description": "Step-by-step operational procedure with roles and checklists.",
        "outline": [
            {"title": "Purpose", "prompt": "Why this SOP exists and what it achieves."},
            {"title": "Scope and Applicability", "prompt": "Who and what this SOP applies to."},
            {"title": "Roles and Responsibilities", "prompt": "RACI-style role definitions."},
            {"title": "Procedure", "children": [
                {"title": "Prerequisites", "prompt": "Required tools, access, and conditions."},
                {"title": "Steps", "prompt": "Numbered, unambiguous procedure steps."},
            ]},
            {"title": "Quality Checklist", "prompt": "Verification checklist after execution."},
            {"title": "Troubleshooting", "prompt": "Common issues and resolutions."},
        ],
    },
    {
        "name": "Business Proposal",
        "doc_type": "proposal",
        "description": "Persuasive proposal: problem, solution, pricing, call to action.",
        "outline": [
            {"title": "Executive Summary", "prompt": "One-page persuasive overview of the proposal."},
            {"title": "Problem Statement", "prompt": "The client's problem and its business impact."},
            {"title": "Proposed Solution", "prompt": "Your solution and why it is the best fit."},
            {"title": "Deliverables and Timeline", "prompt": "What will be delivered and when."},
            {"title": "Pricing", "prompt": "Cost breakdown and payment terms."},
            {"title": "About Us", "prompt": "Company credibility, case studies, team."},
            {"title": "Next Steps", "prompt": "Clear call to action and contact details."},
        ],
    },
    {
        "name": "Meeting Notes",
        "doc_type": "meeting",
        "description": "Structured notes: attendees, decisions, action items.",
        "outline": [
            {"title": "Attendees", "prompt": "List participants and their roles."},
            {"title": "Agenda", "prompt": "Topics discussed, in order."},
            {"title": "Discussion Summary", "prompt": "Key points per agenda item."},
            {"title": "Decisions", "prompt": "Decisions made, with rationale."},
            {"title": "Action Items", "prompt": "Checklist of actions with owners and due dates."},
        ],
    },
    {
        "name": "Technical Design Document",
        "doc_type": "design",
        "description": "Architecture and design decisions for a system or feature.",
        "outline": [
            {"title": "Context and Goals", "prompt": "Background, goals, non-goals."},
            {"title": "Current State", "prompt": "How things work today."},
            {"title": "Proposed Design", "children": [
                {"title": "Architecture", "prompt": "Components, data flow, diagrams (mermaid ok)."},
                {"title": "APIs and Data Models", "prompt": "Interfaces and schemas."},
            ]},
            {"title": "Alternatives Considered", "prompt": "Other options and why they were rejected."},
            {"title": "Security and Privacy", "prompt": "Threat model and mitigations."},
            {"title": "Rollout Plan", "prompt": "Migration, feature flags, monitoring."},
        ],
    },
]


class TemplateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.templates = TemplateRepository(db)

    def list(self) -> list[TemplateOut]:
        return [TemplateOut.model_validate(t) for t in self.templates.all_visible()]

    def get_or_404(self, template_id: str) -> Template:
        template = self.templates.get(template_id)
        if not template:
            from app.core.errors import NotFoundError
            raise NotFoundError("Template not found")
        return template

    def create(self, user: User, data: TemplateCreate) -> TemplateOut:
        template = Template(
            name=data.name, description=data.description, doc_type=data.doc_type,
            outline=data.outline, is_builtin=False, created_by=user.id,
        )
        self.templates.add(template)
        self.db.commit()
        return TemplateOut.model_validate(template)


def seed_builtin_templates(db: Session) -> None:
    repo = TemplateRepository(db)
    existing = {t.name for t in repo.all_visible()}
    for spec in BUILTIN_TEMPLATES:
        if spec["name"] not in existing:
            repo.add(Template(**spec, is_builtin=True))
    db.commit()
