"""Specialist agent definitions and registry."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SpecialistCapability:
    name: str
    description: str
    tools: list[str] = field(default_factory=list)


@dataclass
class SpecialistDefinition:
    name: str
    display_name: str
    description: str
    system_prompt: str
    capabilities: list[SpecialistCapability] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)
    memory_scopes: list[str] = field(default_factory=list)
    context_requirements: list[str] = field(default_factory=list)
    responsibilities: list[str] = field(default_factory=list)
    temperature: float = 0.7
    max_tokens: int = 4096
    icon: str = "🤖"


_specialists: dict[str, SpecialistDefinition] = {}


def register_specialist(spec: SpecialistDefinition) -> None:
    _specialists[spec.name] = spec


def get_specialist(name: str) -> SpecialistDefinition | None:
    return _specialists.get(name)


def get_specialist_names() -> list[str]:
    return list(_specialists.keys())


def list_specialists() -> list[SpecialistDefinition]:
    return list(_specialists.values())


def get_specialist_for_task(task: str) -> str:
    """Route a task to the most appropriate specialist."""
    task_lower = task.lower()
    for name, spec in _specialists.items():
        caps = " ".join(c.name for c in spec.capabilities) + " " + " ".join(spec.responsibilities)
        if task_lower in caps.lower():
            return name
    return "technical_writer"


# ---- Register all 20 specialists ----

register_specialist(SpecialistDefinition(
    name="planner",
    display_name="Planner",
    description="Strategic planning and task decomposition specialist",
    system_prompt="You are a strategic planner. Your role is to break down complex tasks into manageable steps, identify dependencies, and create execution roadmaps. Always consider risks, timelines, and resource requirements.",
    capabilities=[
        SpecialistCapability("task_decomposition", "Break complex tasks into steps", ["knowledge_graph", "memory"]),
        SpecialistCapability("dependency_mapping", "Identify task dependencies and ordering", ["knowledge_graph"]),
        SpecialistCapability("risk_assessment", "Evaluate risks and suggest mitigations", []),
    ],
    tools=["knowledge_graph", "memory", "search"],
    memory_scopes=["user", "project", "workspace"],
    context_requirements=["project_goals", "constraints", "available_resources"],
    responsibilities=[
        "Decompose complex tasks into actionable steps",
        "Identify critical path and dependencies",
        "Assess risks and propose mitigations",
        "Create execution timelines",
    ],
    temperature=0.6,
))

register_specialist(SpecialistDefinition(
    name="researcher",
    display_name="Researcher",
    description="Deep research and information gathering specialist",
    system_prompt="You are a research specialist. Your role is to gather, analyze, and synthesize information from multiple sources. You verify facts, identify patterns, and provide comprehensive research summaries.",
    capabilities=[
        SpecialistCapability("information_gathering", "Collect information from knowledge sources", ["search", "knowledge_graph", "memory"]),
        SpecialistCapability("fact_verification", "Verify claims against known facts", ["knowledge_graph"]),
        SpecialistCapability("pattern_analysis", "Identify patterns and trends across data", []),
    ],
    tools=["search", "knowledge_graph", "memory"],
    memory_scopes=["project", "workspace", "organization"],
    responsibilities=[
        "Gather relevant information from all available sources",
        "Verify facts and claims against knowledge base",
        "Identify patterns and trends",
        "Provide comprehensive research summaries",
    ],
    temperature=0.5,
))

register_specialist(SpecialistDefinition(
    name="business_analyst",
    display_name="Business Analyst",
    description="Requirements analysis, stakeholder management, and business process design",
    system_prompt="You are a business analyst. Your expertise is in understanding business needs, defining requirements, analyzing processes, and bridging the gap between business stakeholders and technical teams.",
    capabilities=[
        SpecialistCapability("requirements_analysis", "Analyze and document business requirements", ["knowledge_graph", "memory"]),
        SpecialistCapability("stakeholder_management", "Identify and manage stakeholder needs", []),
        SpecialistCapability("process_modeling", "Design and document business processes", []),
    ],
    tools=["knowledge_graph", "memory", "search"],
    memory_scopes=["project", "workspace", "organization"],
    context_requirements=["business_goals", "stakeholder_map", "current_processes"],
    responsibilities=[
        "Analyze and document business requirements",
        "Model business processes and workflows",
        "Identify stakeholder needs and concerns",
        "Bridge business and technical teams",
    ],
    temperature=0.6,
))

register_specialist(SpecialistDefinition(
    name="product_manager",
    display_name="Product Manager",
    description="Product strategy, roadmapping, and feature prioritization",
    system_prompt="You are a product manager. You excel at defining product vision, prioritizing features based on impact and effort, creating roadmaps, and ensuring alignment with business goals and user needs.",
    capabilities=[
        SpecialistCapability("roadmapping", "Create and maintain product roadmaps", ["knowledge_graph", "memory"]),
        SpecialistCapability("prioritization", "Prioritize features using impact/effort analysis", []),
        SpecialistCapability("stakeholder_communication", "Communicate product decisions to stakeholders", []),
    ],
    tools=["knowledge_graph", "memory"],
    memory_scopes=["project", "workspace", "organization"],
    context_requirements=["product_vision", "user_research", "business_goals"],
    responsibilities=[
        "Define and communicate product vision",
        "Create and maintain product roadmaps",
        "Prioritize features based on data",
        "Ensure alignment with business goals",
    ],
    temperature=0.6,
))

register_specialist(SpecialistDefinition(
    name="architect",
    display_name="Software Architect",
    description="System architecture design, technology decisions, and architectural patterns",
    system_prompt="You are a software architect. You design system architectures, make technology decisions, establish architectural patterns, and ensure systems are scalable, maintainable, and aligned with business requirements.",
    capabilities=[
        SpecialistCapability("architecture_design", "Design system architectures and patterns", ["knowledge_graph"]),
        SpecialistCapability("technology_selection", "Evaluate and select technology stacks", []),
        SpecialistCapability("technical_debt_analysis", "Identify and address technical debt", []),
    ],
    tools=["knowledge_graph", "search"],
    memory_scopes=["project", "workspace", "organization"],
    context_requirements=["requirements", "constraints", "existing_architecture"],
    responsibilities=[
        "Design scalable and maintainable architectures",
        "Make technology decisions with rationale",
        "Establish and enforce architectural patterns",
        "Review architecture for compliance and security",
    ],
    temperature=0.4,
))

register_specialist(SpecialistDefinition(
    name="backend_engineer",
    display_name="Backend Engineer",
    description="Server-side development, API design, database design, and backend systems",
    system_prompt="You are a backend engineer. You design and implement server-side logic, APIs, databases, and integrate systems. You write clean, efficient, and well-tested backend code.",
    capabilities=[
        SpecialistCapability("api_design", "Design RESTful and GraphQL APIs", ["knowledge_graph"]),
        SpecialistCapability("database_design", "Design database schemas and queries", ["knowledge_graph"]),
        SpecialistCapability("backend_implementation", "Implement server-side logic and services", []),
    ],
    tools=["knowledge_graph", "search"],
    memory_scopes=["project", "workspace"],
    context_requirements=["api_specifications", "data_models", "business_rules"],
    responsibilities=[
        "Design and implement backend services",
        "Create and document APIs",
        "Design and optimize database schemas",
        "Write unit and integration tests",
    ],
    temperature=0.4,
))

register_specialist(SpecialistDefinition(
    name="frontend_engineer",
    display_name="Frontend Engineer",
    description="UI development, component design, state management, and frontend architecture",
    system_prompt="You are a frontend engineer. You build responsive, accessible, and performant user interfaces. You specialize in component architecture, state management, and creating excellent user experiences.",
    capabilities=[
        SpecialistCapability("ui_development", "Build responsive UI components and pages", []),
        SpecialistCapability("state_management", "Design state management solutions", []),
        SpecialistCapability("performance_optimization", "Optimize frontend performance", []),
    ],
    tools=["search"],
    memory_scopes=["project", "workspace"],
    context_requirements=["design_system", "api_endpoints", "user_flows"],
    responsibilities=[
        "Build responsive and accessible UIs",
        "Implement design systems and components",
        "Manage application state effectively",
        "Optimize frontend performance",
    ],
    temperature=0.4,
))

register_specialist(SpecialistDefinition(
    name="database_designer",
    display_name="Database Designer",
    description="Database schema design, query optimization, and data modeling",
    system_prompt="You are a database designer. You design efficient database schemas, write optimized queries, model complex data relationships, and ensure data integrity, performance, and scalability.",
    capabilities=[
        SpecialistCapability("schema_design", "Design normalized and performant schemas", ["knowledge_graph"]),
        SpecialistCapability("query_optimization", "Optimize queries for performance", []),
        SpecialistCapability("data_modeling", "Model complex data relationships", ["knowledge_graph"]),
    ],
    tools=["knowledge_graph", "search"],
    memory_scopes=["project", "workspace"],
    context_requirements=["data_requirements", "access_patterns", "volume_estimates"],
    responsibilities=[
        "Design efficient and scalable database schemas",
        "Optimize queries for performance",
        "Model complex data relationships",
        "Ensure data integrity and consistency",
    ],
    temperature=0.3,
))

register_specialist(SpecialistDefinition(
    name="ux_reviewer",
    display_name="UX Reviewer",
    description="User experience evaluation, usability testing, and design review",
    system_prompt="You are a UX reviewer. You evaluate user interfaces for usability, accessibility, and consistency. You identify UX issues, suggest improvements, and ensure designs follow best practices.",
    capabilities=[
        SpecialistCapability("usability_evaluation", "Evaluate interfaces for usability issues", []),
        SpecialistCapability("accessibility_check", "Check WCAG and accessibility compliance", []),
        SpecialistCapability("design_consistency", "Ensure consistency with design systems", []),
    ],
    tools=[],
    memory_scopes=["workspace", "organization"],
    context_requirements=["design_system", "user_personas", "accessibility_standards"],
    responsibilities=[
        "Evaluate UI for usability issues",
        "Check WCAG accessibility compliance",
        "Ensure design consistency",
        "Suggest UX improvements",
    ],
    temperature=0.5,
))

register_specialist(SpecialistDefinition(
    name="technical_writer",
    display_name="Technical Writer",
    description="Documentation, technical writing, and knowledge base management",
    system_prompt="You are a technical writer. You create clear, comprehensive, and well-structured documentation. You excel at explaining complex technical concepts to different audiences.",
    capabilities=[
        SpecialistCapability("documentation", "Create comprehensive technical documentation", ["knowledge_graph", "memory"]),
        SpecialistCapability("knowledge_management", "Organize and maintain knowledge bases", ["knowledge_graph"]),
        SpecialistCapability("content_strategy", "Plan and structure documentation", []),
    ],
    tools=["knowledge_graph", "memory", "search"],
    memory_scopes=["user", "project", "workspace", "organization"],
    context_requirements=["project_context", "target_audience", "documentation_standards"],
    responsibilities=[
        "Create clear and comprehensive documentation",
        "Maintain knowledge bases and documentation sets",
        "Adapt content for different audiences",
        "Ensure documentation accuracy and currency",
    ],
    temperature=0.5,
))

register_specialist(SpecialistDefinition(
    name="compliance_officer",
    display_name="Compliance Officer",
    description="Regulatory compliance, policy enforcement, and compliance documentation",
    system_prompt="You are a compliance officer. You ensure all content, code, and processes comply with relevant regulations (GDPR, SOC2, ISO27001, DPDP), company policies, and industry standards.",
    capabilities=[
        SpecialistCapability("regulatory_check", "Check content against regulatory requirements", ["knowledge_graph"]),
        SpecialistCapability("policy_enforcement", "Ensure compliance with internal policies", []),
        SpecialistCapability("compliance_documentation", "Generate compliance evidence", []),
    ],
    tools=["knowledge_graph", "search"],
    memory_scopes=["organization"],
    context_requirements=["compliance_standards", "company_policies", "regulatory_requirements"],
    responsibilities=[
        "Ensure regulatory compliance across all content",
        "Enforce internal policies and standards",
        "Generate compliance evidence and reports",
        "Flag potential compliance violations",
    ],
    temperature=0.3,
))

register_specialist(SpecialistDefinition(
    name="security_auditor",
    display_name="Security Auditor",
    description="Security review, vulnerability assessment, and security best practices",
    system_prompt="You are a security auditor. You review code, architecture, and content for security vulnerabilities. You follow OWASP guidelines and security best practices to identify and mitigate risks.",
    capabilities=[
        SpecialistCapability("vulnerability_scanning", "Identify security vulnerabilities in code and architecture", []),
        SpecialistCapability("threat_modeling", "Model potential threats and attack vectors", []),
        SpecialistCapability("security_review", "Review implementations for security best practices", []),
    ],
    tools=["search"],
    memory_scopes=["organization"],
    context_requirements=["security_policies", "threat_model", "architecture_diagrams"],
    responsibilities=[
        "Identify security vulnerabilities",
        "Review implementations for security issues",
        "Model threats and attack vectors",
        "Recommend security improvements",
    ],
    temperature=0.3,
))

register_specialist(SpecialistDefinition(
    name="fact_checker",
    display_name="Fact Checker",
    description="Fact verification, source validation, and claim substantiation",
    system_prompt="You are a fact checker. Your role is to verify claims, validate sources, and ensure accuracy. You identify unsupported assertions and request evidence for questionable claims.",
    capabilities=[
        SpecialistCapability("claim_verification", "Verify factual claims against trusted sources", ["knowledge_graph", "search"]),
        SpecialistCapability("source_validation", "Evaluate source credibility and reliability", []),
        SpecialistCapability("contradiction_detection", "Identify contradictions in content", ["knowledge_graph"]),
    ],
    tools=["knowledge_graph", "search", "memory"],
    memory_scopes=["project", "workspace", "organization"],
    responsibilities=[
        "Verify factual claims against knowledge base",
        "Evaluate source credibility",
        "Detect contradictions in content",
        "Flag unsubstantiated assertions",
    ],
    temperature=0.3,
))

register_specialist(SpecialistDefinition(
    name="legal_reviewer",
    display_name="Legal Reviewer",
    description="Legal compliance, contract review, and risk assessment from legal perspective",
    system_prompt="You are a legal reviewer. You review content for legal risks, ensure compliance with applicable laws, and identify potential legal issues in documentation, agreements, and product decisions.",
    capabilities=[
        SpecialistCapability("legal_compliance", "Check content for legal compliance", ["knowledge_graph"]),
        SpecialistCapability("risk_identification", "Identify legal risks and exposures", []),
        SpecialistCapability("contract_review", "Review agreements and terms", []),
    ],
    tools=["knowledge_graph", "search"],
    memory_scopes=["organization"],
    context_requirements=["jurisdiction", "applicable_laws", "company_policies"],
    responsibilities=[
        "Review content for legal compliance",
        "Identify legal risks and exposures",
        "Ensure terms and conditions accuracy",
        "Flag intellectual property concerns",
    ],
    temperature=0.3,
))

register_specialist(SpecialistDefinition(
    name="performance_optimizer",
    display_name="Performance Optimizer",
    description="Performance analysis, optimization recommendations, and benchmarking",
    system_prompt="You are a performance optimizer. You analyze systems for performance bottlenecks, recommend optimizations, and help implement performance improvements across the stack.",
    capabilities=[
        SpecialistCapability("bottleneck_analysis", "Identify performance bottlenecks in code and architecture", []),
        SpecialistCapability("optimization_recommendations", "Recommend performance improvements", []),
        SpecialistCapability("benchmarking", "Design and analyze performance benchmarks", []),
    ],
    tools=["search"],
    memory_scopes=["project", "workspace"],
    context_requirements=["architecture", "performance_metrics", "usage_patterns"],
    responsibilities=[
        "Identify performance bottlenecks",
        "Recommend optimization strategies",
        "Analyze performance metrics",
        "Design and evaluate benchmarks",
    ],
    temperature=0.4,
))

register_specialist(SpecialistDefinition(
    name="accessibility_reviewer",
    display_name="Accessibility Reviewer",
    description="WCAG compliance, accessibility audit, and inclusive design review",
    system_prompt="You are an accessibility reviewer. You evaluate content and interfaces for accessibility compliance (WCAG 2.1/2.2). You ensure inclusive design and identify barriers for users with disabilities.",
    capabilities=[
        SpecialistCapability("wcag_audit", "Audit against WCAG success criteria", []),
        SpecialistCapability("inclusive_design", "Review for inclusive design principles", []),
        SpecialistCapability("accessibility_remediation", "Suggest fixes for accessibility issues", []),
    ],
    tools=[],
    memory_scopes=["organization"],
    context_requirements=["accessibility_standards", "user_personas", "design_system"],
    responsibilities=[
        "Audit for WCAG compliance",
        "Review for inclusive design",
        "Identify accessibility barriers",
        "Suggest remediation strategies",
    ],
    temperature=0.4,
))

register_specialist(SpecialistDefinition(
    name="translator",
    display_name="Translator",
    description="Multi-language translation with cultural adaptation and localization",
    system_prompt="You are a translator. You translate content between languages while preserving meaning, tone, and style. You consider cultural context and adapt content appropriately for the target audience.",
    capabilities=[
        SpecialistCapability("translation", "Translate between languages while preserving meaning", ["memory"]),
        SpecialistCapability("localization", "Adapt content for cultural context", []),
        SpecialistCapability("terminology_management", "Maintain consistent terminology across languages", ["memory"]),
    ],
    tools=["memory"],
    memory_scopes=["user", "project"],
    context_requirements=["source_language", "target_language", "domain_context"],
    responsibilities=[
        "Translate content accurately between languages",
        "Adapt content for cultural context",
        "Maintain consistent terminology",
        "Preserve tone and style across languages",
    ],
    temperature=0.5,
))

register_specialist(SpecialistDefinition(
    name="teacher",
    display_name="Teacher",
    description="Knowledge explanation, tutorial creation, and learning content design",
    system_prompt="You are a teacher. You explain complex concepts clearly, create engaging learning content, and adapt your teaching style to the learner's level and preferences.",
    capabilities=[
        SpecialistCapability("explanation", "Explain complex concepts in accessible terms", ["knowledge_graph", "memory"]),
        SpecialistCapability("tutorial_creation", "Create step-by-step tutorials and guides", []),
        SpecialistCapability("learning_assessment", "Design exercises and assessments", []),
    ],
    tools=["knowledge_graph", "memory", "search"],
    memory_scopes=["user", "project"],
    context_requirements=["learner_level", "topic_knowledge", "learning_goals"],
    responsibilities=[
        "Explain complex concepts clearly",
        "Create engaging tutorials and guides",
        "Adapt teaching to learner level",
        "Design effective learning assessments",
    ],
    temperature=0.6,
))

register_specialist(SpecialistDefinition(
    name="reviewer",
    display_name="Reviewer",
    description="Content review, quality assurance, and editorial oversight",
    system_prompt="You are a reviewer. You review content for quality, consistency, clarity, and correctness. You provide constructive feedback and ensure content meets the required standards before publication.",
    capabilities=[
        SpecialistCapability("quality_review", "Review content for quality and correctness", []),
        SpecialistCapability("consistency_check", "Check for consistency in style and terminology", ["memory"]),
        SpecialistCapability("editorial_oversight", "Provide editorial guidance and improvements", []),
    ],
    tools=["memory", "search"],
    memory_scopes=["user", "project", "workspace"],
    context_requirements=["style_guide", "quality_standards", "target_audience"],
    responsibilities=[
        "Review content for quality and correctness",
        "Ensure consistency in style and terminology",
        "Provide constructive editorial feedback",
        "Verify content meets publication standards",
    ],
    temperature=0.4,
))

register_specialist(SpecialistDefinition(
    name="summarizer",
    display_name="Summarizer",
    description="Content summarization, key point extraction, and executive briefing",
    system_prompt="You are a summarizer. You distill complex information into clear, concise summaries. You identify key points, extract actionable insights, and create executive-level briefings.",
    capabilities=[
        SpecialistCapability("summarization", "Distill complex content into concise summaries", []),
        SpecialistCapability("key_point_extraction", "Extract key points and actionable insights", []),
        SpecialistCapability("executive_briefing", "Create executive-level briefings", []),
    ],
    tools=["memory", "search"],
    memory_scopes=["user", "project", "workspace"],
    responsibilities=[
        "Distill complex information into clear summaries",
        "Extract key points and actionable insights",
        "Create executive-level briefings",
        "Adapt summary length and detail to audience",
    ],
    temperature=0.4,
))
