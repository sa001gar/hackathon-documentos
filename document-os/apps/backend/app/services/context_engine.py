"""Context Engine: automatically gathers relevant context from all memory layers,
knowledge graph, past decisions, project docs, and user preferences.

Avoids asking users to repeat themselves.
"""
from sqlalchemy.orm import Session

from app.repositories import kg_node_repo, memory_repo, decision_repo


def build_full_context(
    db: Session,
    *,
    user_id: str | None = None,
    project_id: str | None = None,
    workspace_id: str | None = None,
    document_id: str | None = None,
    query: str | None = None,
) -> dict:
    """Assemble comprehensive context from all available sources."""
    ctx = {"user": {}, "project": {}, "workspace": {}, "organization": {}, "decisions": [], "related_nodes": []}

    if user_id:
        user_mem = memory_repo.get_by_scope(db, "user", user_id)
        ctx["user"] = {m.key: m.value for m in user_mem}
        ctx["user"]["style"] = next(
            (m.value for m in user_mem if m.key == "writing_style"), {}
        )
        ctx["user"]["preferences"] = next(
            (m.value for m in user_mem if m.key == "preferences"), {}
        )

    if project_id:
        proj_mem = memory_repo.get_by_scope(db, "project", project_id)
        ctx["project"] = {m.key: m.value for m in proj_mem}
        decisions = decision_repo.get_for_project(db, project_id, limit=10)
        ctx["decisions"] = [
            {"title": d.title, "status": d.status, "decision": d.decision[:500]}
            for d in decisions
        ]
        nodes = kg_node_repo.get_by_source(db, project_id)
        ctx["related_nodes"] = [{"id": n.id, "label": n.label, "type": n.node_type} for n in nodes[:20]]

    if workspace_id:
        ws_mem = memory_repo.get_by_scope(db, "workspace", workspace_id)
        ctx["workspace"] = {m.key: m.value for m in ws_mem}

    if query:
        semantic_matches = memory_repo.search_semantic(db, query, limit=5)
        ctx["semantic_matches"] = [
            {"key": m.key, "content": m.content[:300], "scope": m.scope, "confidence": m.confidence}
            for m in semantic_matches
        ]

    return ctx


def get_user_preferences(db: Session, user_id: str) -> dict:
    memories = memory_repo.get_by_scope(db, "user", user_id)
    prefs = {}
    for m in memories:
        if m.key in ("writing_style", "tone", "language", "formatting", "vocabulary", "preferences"):
            prefs[m.key] = m.value
    return prefs


def get_project_knowledge(db: Session, project_id: str, key: str | None = None) -> dict:
    memories = memory_repo.get_by_scope(db, "project", project_id)
    if key:
        return {m.key: m.value for m in memories if m.key == key}
    return {m.key: m.value for m in memories}
