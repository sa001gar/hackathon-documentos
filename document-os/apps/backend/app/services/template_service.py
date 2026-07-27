"""Template business logic: CRUD + idempotent seeding of builtin templates."""
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Template
from app.repositories import template_repo
from app.schemas.template import TemplateCreate

BUILTIN_TEMPLATES: list[dict] = [
    {
        "name": "Product Requirements Document (PRD)",
        "description": "Define what to build, why, and how success is measured.",
        "category": "Product",
        "structure": [
            {"title": "Overview", "prompt": "Summarize the product/feature, the problem it solves, and the target users. One concise paragraph plus a short bullet list of key value propositions. ~150 words."},
            {"title": "Goals & Success Metrics", "prompt": "List 3-5 measurable goals (business and user outcomes) with target metrics and timeframes. Use a bullet list or small table. ~200 words."},
            {"title": "User Stories & Use Cases", "prompt": "Describe the primary usage scenarios end to end. ~250 words total across subsections.", "children": [
                {"title": "Personas", "prompt": "Define 2-3 user personas: role, goals, frustrations, and context of use. ~120 words each."},
                {"title": "User Journeys", "prompt": "Walk through the main user journeys step by step, noting entry points and decision moments. ~200 words."},
            ]},
            {"title": "Functional Requirements", "prompt": "Specify what the system must do. ~300 words total across subsections.", "children": [
                {"title": "Core Features", "prompt": "Enumerate core features as numbered requirements (FR-1, FR-2, ...) each with priority (P0/P1/P2) and acceptance criteria. ~250 words."},
                {"title": "Out of Scope", "prompt": "Explicitly list what will NOT be built in this iteration and why. ~100 words."},
            ]},
            {"title": "Non-Functional Requirements", "prompt": "Cover performance, scalability, security, privacy, accessibility, and localization expectations with concrete targets. ~200 words."},
            {"title": "UX & Design Considerations", "prompt": "Describe key screens/flows, interaction principles, and links or references to mockups. ~150 words."},
            {"title": "Analytics & Tracking", "prompt": "List the events and KPIs to instrument for measuring adoption and success. ~120 words."},
            {"title": "Rollout Plan", "prompt": "Outline phasing: beta, gradual rollout, feature flags, and rollback strategy. ~120 words."},
            {"title": "Open Questions", "prompt": "List unresolved decisions, owners, and due dates as bullets. ~80 words."},
        ],
    },
    {
        "name": "Software Requirements Specification (SRS)",
        "description": "Formal, IEEE-style requirements specification for a software system.",
        "category": "Engineering",
        "structure": [
            {"title": "Introduction", "prompt": "Frame the document and the system it specifies. ~200 words total.", "children": [
                {"title": "Purpose", "prompt": "State the purpose of this SRS and its intended audience. ~80 words."},
                {"title": "Scope", "prompt": "Describe the software product scope: benefits, objectives, and boundaries. ~120 words."},
                {"title": "Definitions & Acronyms", "prompt": "Define domain terms and acronyms used throughout the document as a bullet list. ~100 words."},
            ]},
            {"title": "Overall Description", "prompt": "Give the high-level context before detailed requirements. ~250 words total.", "children": [
                {"title": "Product Perspective", "prompt": "Position the product within larger systems: context diagram description, interfaces, and dependencies. ~120 words."},
                {"title": "User Characteristics", "prompt": "Describe the user classes, their expertise levels, and accessibility needs. ~100 words."},
                {"title": "Assumptions & Dependencies", "prompt": "List assumptions that, if changed, would affect requirements, plus external dependencies. ~100 words."},
            ]},
            {"title": "Functional Requirements", "prompt": "Introduce the requirements organization, then detail them in subsections. ~350 words total.", "children": [
                {"title": "System Features", "prompt": "Specify each system feature as REQ-<id> with description, inputs/outputs, and validation rules. ~250 words."},
                {"title": "Use Cases", "prompt": "Provide 3-5 use cases with actor, preconditions, main flow, and alternate flows. ~200 words."},
            ]},
            {"title": "External Interface Requirements", "prompt": "Document all interfaces to the outside world. ~200 words total.", "children": [
                {"title": "API Interfaces", "prompt": "List external APIs consumed/exposed with protocols, formats, and authentication. ~120 words."},
                {"title": "Hardware & Software Interfaces", "prompt": "Describe OS, database, browser, and hardware interface constraints. ~100 words."},
            ]},
            {"title": "Non-Functional Requirements", "prompt": "Cover quality attributes with measurable criteria. ~250 words total.", "children": [
                {"title": "Performance", "prompt": "State latency, throughput, and capacity targets with numbers. ~100 words."},
                {"title": "Security", "prompt": "Specify authentication, authorization, data protection, and compliance requirements. ~120 words."},
                {"title": "Reliability & Availability", "prompt": "Define uptime targets, failure handling, backup, and recovery requirements. ~100 words."},
            ]},
            {"title": "Appendices", "prompt": "Include supporting material: data dictionaries, diagrams, or references. ~100 words."},
        ],
    },
    {
        "name": "Research Paper (IMRaD)",
        "description": "Standard empirical research structure: Introduction, Methods, Results, and Discussion.",
        "category": "Research",
        "structure": [
            {"title": "Abstract", "prompt": "Summarize motivation, methods, key results, and conclusions in one dense paragraph. 150-250 words."},
            {"title": "Introduction", "prompt": "Set up the research problem and its significance. ~400 words total.", "children": [
                {"title": "Background", "prompt": "Provide the context and prior work needed to understand the problem. ~200 words."},
                {"title": "Research Questions & Contributions", "prompt": "State the research questions explicitly and enumerate the paper's contributions as bullets. ~150 words."},
            ]},
            {"title": "Methods", "prompt": "Describe the methodology so the study is reproducible. ~400 words total.", "children": [
                {"title": "Experimental Setup", "prompt": "Detail the experimental design, environment, tools, and procedures. ~180 words."},
                {"title": "Datasets & Materials", "prompt": "Describe datasets/materials: sources, sizes, preprocessing, and licensing. ~150 words."},
                {"title": "Evaluation Metrics", "prompt": "Define the metrics and statistical tests used, with justification. ~120 words."},
            ]},
            {"title": "Results", "prompt": "Report findings objectively with tables/figures described in text; no interpretation here. ~300 words."},
            {"title": "Discussion", "prompt": "Interpret the results and their implications. ~350 words total.", "children": [
                {"title": "Interpretation", "prompt": "Explain what the results mean relative to the research questions. ~180 words."},
                {"title": "Limitations & Threats to Validity", "prompt": "Honestly discuss limitations, biases, and threats to validity. ~150 words."},
            ]},
            {"title": "Related Work", "prompt": "Position this work against the closest prior research, highlighting differences. ~200 words."},
            {"title": "Conclusion & Future Work", "prompt": "Summarize takeaways and propose concrete future directions. ~150 words."},
            {"title": "References", "prompt": "List cited works in a consistent citation style (e.g., APA). One entry per line."},
        ],
    },
    {
        "name": "Technical Documentation",
        "description": "User-facing documentation for a software product or platform.",
        "category": "Technical",
        "structure": [
            {"title": "Overview", "prompt": "Explain what the product does, who it is for, and its main capabilities. ~150 words."},
            {"title": "Architecture", "prompt": "Give a high-level technical orientation. ~300 words total.", "children": [
                {"title": "System Context", "prompt": "Describe how the system fits with external actors and systems; mention a context diagram. ~120 words."},
                {"title": "Components", "prompt": "Describe each major component, its responsibility, and technology. ~150 words."},
                {"title": "Data Flow", "prompt": "Walk through the main data flows end to end. ~120 words."},
            ]},
            {"title": "Getting Started", "prompt": "Get a new user productive fast. ~250 words total.", "children": [
                {"title": "Prerequisites", "prompt": "List required software, accounts, and knowledge with versions. ~60 words as bullets."},
                {"title": "Installation", "prompt": "Provide step-by-step installation instructions with commands in code blocks. ~120 words."},
                {"title": "Quickstart", "prompt": "Show a minimal working example end to end with code blocks. ~120 words."},
            ]},
            {"title": "Configuration", "prompt": "Document every configuration option: name, default, allowed values, and examples. Use a table. ~150 words."},
            {"title": "Usage Guides", "prompt": "Provide task-oriented how-to guides for the 3-5 most common workflows, with examples. ~250 words."},
            {"title": "Troubleshooting", "prompt": "List common errors, their causes, and fixes as problem/solution pairs. ~150 words."},
            {"title": "FAQ", "prompt": "Answer 5-8 frequently asked questions concisely. ~150 words."},
            {"title": "Glossary", "prompt": "Define product-specific terms as a bullet list. ~80 words."},
        ],
    },
    {
        "name": "API Documentation",
        "description": "Complete reference for a REST/HTTP API: endpoints, auth, and errors.",
        "category": "Technical",
        "structure": [
            {"title": "Overview", "prompt": "Introduce the API: purpose, base URL, versioning scheme, and content types. ~120 words."},
            {"title": "Authentication & Authorization", "prompt": "Explain the auth scheme (e.g., Bearer tokens/OAuth2), how to obtain credentials, and permission scopes with examples. ~180 words."},
            {"title": "Rate Limits & Quotas", "prompt": "Document rate limits, quota tiers, and the headers/clients behavior when exceeded. ~100 words."},
            {"title": "Endpoints", "prompt": "Organize the endpoint reference by resource. ~400 words total.", "children": [
                {"title": "Resources & Routes", "prompt": "List all routes in a table: method, path, description, and required permissions. ~150 words."},
                {"title": "Request Formats", "prompt": "Document path/query/body parameters per endpoint with types, constraints, and JSON examples in code blocks. ~200 words."},
                {"title": "Response Formats", "prompt": "Show success response schemas with JSON examples and field descriptions. ~180 words."},
            ]},
            {"title": "Error Codes & Handling", "prompt": "Provide a table of HTTP status codes and error envelopes, plus retry guidance for clients. ~150 words."},
            {"title": "SDKs & Examples", "prompt": "Show real usage in multiple tools. ~200 words total.", "children": [
                {"title": "cURL Examples", "prompt": "Provide copy-paste cURL examples for the most common operations in code blocks. ~120 words."},
                {"title": "Python Examples", "prompt": "Provide a short Python client example using requests/httpx in a code block. ~120 words."},
            ]},
            {"title": "Changelog & Versioning", "prompt": "Explain the versioning policy and summarize breaking changes per version. ~100 words."},
        ],
    },
    {
        "name": "Standard Operating Procedure (SOP)",
        "description": "Repeatable, auditable procedure for an operational process.",
        "category": "Operations",
        "structure": [
            {"title": "Purpose & Scope", "prompt": "State what this SOP covers, why it exists, and what is explicitly out of scope. ~120 words."},
            {"title": "Roles & Responsibilities", "prompt": "List the roles involved and their responsibilities, ideally as a RACI-style table. ~120 words."},
            {"title": "Definitions", "prompt": "Define terms, tools, and abbreviations used in the procedure. ~80 words."},
            {"title": "Procedure", "prompt": "The operational core of the SOP. ~350 words total.", "children": [
                {"title": "Preparation", "prompt": "List prerequisites: access, tools, materials, and pre-checks before starting. ~100 words."},
                {"title": "Step-by-Step Instructions", "prompt": "Write numbered, unambiguous steps with expected outcomes per step and screenshots/placeholders where helpful. ~200 words."},
                {"title": "Quality Checks", "prompt": "Define verification steps and acceptance criteria confirming the procedure succeeded. ~100 words."},
            ]},
            {"title": "Safety & Compliance", "prompt": "Note hazards, safety measures, and regulatory/compliance obligations. ~100 words."},
            {"title": "Troubleshooting & Escalation", "prompt": "List common failure modes with fixes, and the escalation path with contacts. ~120 words."},
            {"title": "Revision History", "prompt": "Provide a table: version, date, author, summary of changes. ~60 words."},
        ],
    },
    {
        "name": "Business Proposal",
        "description": "Persuasive proposal for a client, partner, or internal stakeholder.",
        "category": "Business",
        "structure": [
            {"title": "Executive Summary", "prompt": "One page max: the problem, your solution, key benefits, and the ask. ~200 words."},
            {"title": "Problem Statement", "prompt": "Describe the customer's pain with evidence: costs, risks, and missed opportunities. ~180 words."},
            {"title": "Proposed Solution", "prompt": "Present your solution and why it fits. ~300 words total.", "children": [
                {"title": "Deliverables", "prompt": "Itemize concrete deliverables with descriptions as bullets. ~120 words."},
                {"title": "Differentiators", "prompt": "Explain why your approach beats alternatives and the status quo. ~150 words."},
            ]},
            {"title": "Market Opportunity", "prompt": "Size the opportunity (TAM/SAM/SOM) and describe target segments. ~150 words."},
            {"title": "Pricing & Commercial Terms", "prompt": "Present pricing options in a table with payment terms and what's included. ~150 words."},
            {"title": "Implementation Plan & Timeline", "prompt": "Lay out phases, milestones, and dates, ideally as a simple table. ~150 words."},
            {"title": "Team & Qualifications", "prompt": "Introduce key team members and relevant track record/case studies. ~120 words."},
            {"title": "Next Steps", "prompt": "Give a clear call to action: decision needed, process, and contact details. ~80 words."},
        ],
    },
    {
        "name": "Legal Agreement",
        "description": "Structured contract skeleton with standard clauses (review by counsel required).",
        "category": "Legal",
        "structure": [
            {"title": "Parties & Recitals", "prompt": "Identify the parties with full legal names and recite the background/purpose of the agreement. ~150 words."},
            {"title": "Definitions", "prompt": "Define capitalized terms used throughout the agreement, one definition per line. ~150 words."},
            {"title": "Terms & Conditions", "prompt": "Set out the operative provisions. ~400 words total.", "children": [
                {"title": "Obligations of the Parties", "prompt": "Detail what each party must do, with deadlines and standards of performance. ~180 words."},
                {"title": "Payment Terms", "prompt": "Specify amounts, currency, invoicing, due dates, and late-payment consequences. ~120 words."},
                {"title": "Intellectual Property", "prompt": "Allocate IP ownership, licenses granted, and usage restrictions. ~150 words."},
            ]},
            {"title": "Warranties & Representations", "prompt": "List mutual and party-specific warranties and representations. ~150 words."},
            {"title": "Limitation of Liability & Indemnification", "prompt": "Define liability caps, exclusions, and indemnification obligations and procedures. ~180 words."},
            {"title": "Term & Termination", "prompt": "State the effective date, duration, renewal, and termination rights including notice periods. ~130 words."},
            {"title": "Dispute Resolution & Governing Law", "prompt": "Specify governing law, jurisdiction, and the dispute resolution process (negotiation, mediation, arbitration). ~120 words."},
            {"title": "Signatures", "prompt": "Provide signature blocks for all parties: name, title, date, and signature line. ~60 words."},
        ],
    },
    {
        "name": "Academic Assignment",
        "description": "Structured essay/report format for coursework.",
        "category": "Academic",
        "structure": [
            {"title": "Title & Declaration", "prompt": "Provide the title, course, author details, and an originality declaration. ~60 words."},
            {"title": "Introduction", "prompt": "Introduce the topic and your approach. ~250 words total.", "children": [
                {"title": "Context", "prompt": "Give the background and why the topic matters. ~120 words."},
                {"title": "Objectives", "prompt": "State the aims and research questions of the assignment. ~100 words."},
            ]},
            {"title": "Literature Review", "prompt": "Survey key sources, compare viewpoints, and identify the gap your analysis addresses. ~250 words."},
            {"title": "Main Analysis", "prompt": "Develop your argument with evidence. ~500 words total.", "children": [
                {"title": "Argument", "prompt": "Present your central thesis and supporting reasoning logically. ~180 words."},
                {"title": "Evidence & Examples", "prompt": "Support claims with data, citations, and concrete examples. ~180 words."},
                {"title": "Counterarguments", "prompt": "Address the strongest opposing views fairly and rebut them. ~140 words."},
            ]},
            {"title": "Conclusion", "prompt": "Summarize findings, restate the thesis in light of evidence, and note implications. ~150 words."},
            {"title": "References", "prompt": "List all cited sources in the required citation style (APA/MLA/Harvard), one per line."},
            {"title": "Appendices", "prompt": "Include supplementary material: raw data, calculations, or extra figures. ~80 words."},
        ],
    },
    {
        "name": "Meeting Notes",
        "description": "Actionable record of a meeting: decisions, action items, and owners.",
        "category": "Operations",
        "structure": [
            {"title": "Meeting Details", "prompt": "Record logistics and plan. ~100 words total.", "children": [
                {"title": "Attendees", "prompt": "List attendees (and absentees) with roles. Bulleted list."},
                {"title": "Agenda", "prompt": "List the planned agenda items with time allocations. Bulleted list."},
            ]},
            {"title": "Discussion Summary", "prompt": "Summarize the key points discussed per agenda item, neutrally and concisely. ~200 words."},
            {"title": "Decisions Made", "prompt": "Record each decision with its rationale and who approved it. Numbered list. ~120 words."},
            {"title": "Action Items", "prompt": "Capture follow-up work. ~120 words total.", "children": [
                {"title": "Owners & Deadlines", "prompt": "Table of action items: task, owner, due date, and status. One row per item."},
            ]},
            {"title": "Risks & Blockers", "prompt": "Note anything that threatens progress and proposed mitigations. ~100 words."},
            {"title": "Next Meeting", "prompt": "State the date, tentative agenda, and preparation expected for the next meeting. ~60 words."},
        ],
    },
    {
        "name": "Project Report",
        "description": "Status and outcomes report for stakeholders and sponsors.",
        "category": "Business",
        "structure": [
            {"title": "Executive Summary", "prompt": "Summarize status, key achievements, issues, and the ask in a few sentences plus bullets. ~150 words."},
            {"title": "Project Overview", "prompt": "Remind readers what the project is. ~180 words total.", "children": [
                {"title": "Objectives", "prompt": "Restate the project's objectives and success criteria. ~100 words."},
                {"title": "Scope", "prompt": "Define what is in and out of scope for this reporting period. ~90 words."},
            ]},
            {"title": "Progress & Milestones", "prompt": "Report delivery status. ~250 words total.", "children": [
                {"title": "Completed Work", "prompt": "List completed deliverables and milestones with dates. ~120 words."},
                {"title": "Current Status", "prompt": "Give RAG status per workstream with brief justification. ~120 words."},
            ]},
            {"title": "Budget & Resources", "prompt": "Report spend vs. budget, resource utilization, and variances with explanations. ~130 words."},
            {"title": "Risks & Issues", "prompt": "Table of top risks/issues: description, impact, likelihood, mitigation, owner. ~150 words."},
            {"title": "Results & Outcomes", "prompt": "Present measured outcomes against objectives and KPIs. ~150 words."},
            {"title": "Lessons Learned & Next Steps", "prompt": "Share what worked, what didn't, and the plan for the next period. ~130 words."},
        ],
    },
    {
        "name": "Whitepaper",
        "description": "Authoritative, in-depth report on a technology, method, or policy.",
        "category": "Research",
        "structure": [
            {"title": "Executive Summary", "prompt": "Distill the problem, the proposed approach, and key benefits for a busy executive. ~200 words."},
            {"title": "Introduction & Problem Context", "prompt": "Frame the problem space, its cost/impact, and why existing answers fall short. ~250 words."},
            {"title": "Background & State of the Art", "prompt": "Survey current solutions and research, with balanced critique. ~250 words."},
            {"title": "Proposed Approach", "prompt": "Present your approach in depth. ~400 words total.", "children": [
                {"title": "Architecture", "prompt": "Describe the overall architecture and its components; reference a diagram. ~180 words."},
                {"title": "Methodology", "prompt": "Explain the methodology/principles and why they are sound. ~180 words."},
            ]},
            {"title": "Evaluation & Case Studies", "prompt": "Provide evidence: benchmarks, pilots, or case studies with quantitative results. ~250 words."},
            {"title": "Benefits & Implications", "prompt": "Articulate business/technical benefits, adoption considerations, and broader implications. ~180 words."},
            {"title": "Conclusion", "prompt": "Recap the thesis and evidence; end with a forward-looking statement. ~120 words."},
            {"title": "References", "prompt": "List sources, standards, and prior art cited, one per line."},
        ],
    },
    {
        "name": "Design Document",
        "description": "Technical design for a system or feature before implementation.",
        "category": "Engineering",
        "structure": [
            {"title": "Overview & Goals", "prompt": "Summarize the change, its motivation, and measurable goals. ~180 words total.", "children": [
                {"title": "Non-Goals", "prompt": "Explicitly list what this design will not address to prevent scope creep. ~80 words."},
            ]},
            {"title": "Background & Context", "prompt": "Give the current-state architecture and constraints a reader needs. ~180 words."},
            {"title": "Proposed Design", "prompt": "The core of the document. ~450 words total.", "children": [
                {"title": "Architecture", "prompt": "Describe components, interactions, and lifecycle; reference architecture diagrams. ~180 words."},
                {"title": "Data Model", "prompt": "Specify schemas, entities, relationships, and migration impacts. ~150 words."},
                {"title": "APIs & Interfaces", "prompt": "Define new/changed interfaces: endpoints, payloads, and contracts with examples. ~150 words."},
            ]},
            {"title": "Alternatives Considered", "prompt": "Present 2-3 alternatives with pros/cons and why the chosen design wins. ~180 words."},
            {"title": "Security & Privacy", "prompt": "Analyze threat model, data handling, and compliance implications. ~130 words."},
            {"title": "Performance & Scalability", "prompt": "Estimate load, identify bottlenecks, and describe scaling strategy. ~130 words."},
            {"title": "Rollout & Migration Plan", "prompt": "Describe phased rollout, feature flags, monitoring, and rollback. ~120 words."},
            {"title": "Open Questions", "prompt": "List unresolved design questions with owners. ~80 words."},
        ],
    },
]


def list_templates(db: Session, category: str | None = None) -> list[Template]:
    """List templates, optionally filtered by category."""
    return template_repo.list_all(db, category=category)


def get(db: Session, template_id: str) -> Template:
    """Fetch a template by id; 404 if missing."""
    template = template_repo.get(db, template_id)
    if template is None:
        raise NotFoundError("Template not found")
    return template


def create(db: Session, data: TemplateCreate) -> Template:
    """Create a user-defined template from nested section nodes."""
    return template_repo.create(
        db,
        obj_in={
            "name": data.name,
            "description": data.description,
            "category": data.category,
            "structure": [node.model_dump() for node in data.structure],
            "is_builtin": False,
        },
    )


def seed_builtin_templates(db: Session) -> None:
    """Insert the builtin template catalog; idempotent (skips if any exist).

    Fast-path: counts builtin templates in one query instead of N lookups.
    """
    from sqlalchemy import func, select

    count = db.scalar(select(func.count(Template.id)).where(Template.is_builtin.is_(True)))
    if count and count > 0:
        return

    for spec in BUILTIN_TEMPLATES:
        existing = template_repo.get_by_name(db, spec["name"])
        if existing is not None and existing.is_builtin:
            continue
        template_repo.create(
            db,
            obj_in={
                "name": spec["name"],
                "description": spec["description"],
                "category": spec["category"],
                "structure": spec["structure"],
                "is_builtin": True,
            },
        )
