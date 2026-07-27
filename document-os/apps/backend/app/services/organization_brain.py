"""Organization Brain: answer questions over the knowledge graph + memory.

Answers:
- Why was this built?
- Who approved it?
- When?
- Which document explains it?
- Which API depends on it?
"""
from sqlalchemy.orm import Session

from app.repositories import kg_node_repo, kg_edge_repo, decision_repo, memory_repo


def ask(db: Session, query: str, workspace_id: str | None = None) -> dict:
    """Answer a natural language question using the knowledge graph and memory."""
    query_lower = query.lower()

    # Determine intent from the query pattern
    if "why was" in query_lower or "why is" in query_lower:
        return _answer_why(db, query, workspace_id)
    if "who approved" in query_lower or "who decided" in query_lower:
        return _answer_who(db, query, workspace_id)
    if "when" in query_lower and ("was" in query_lower or "did" in query_lower):
        return _answer_when(db, query, workspace_id)
    if "which document" in query_lower or "which api" in query_lower or "what depends" in query_lower:
        return _answer_dependency(db, query, workspace_id)
    if "what changed" in query_lower:
        return _answer_what_changed(db, query, workspace_id)
    if "explain" in query_lower or "what is" in query_lower:
        return _answer_explain(db, query, workspace_id)

    # Default: semantic search over everything
    return _semantic_search(db, query, workspace_id)


def _answer_why(db: Session, query: str, workspace_id: str | None) -> dict:
    """Find decisions related to the entity in the query."""
    import re
    match = re.search(r'(?:was|is)\s+(.+?)\s+(?:built|created|added|implemented|designed)\??', query)
    entity = match.group(1) if match else query
    nodes = kg_node_repo.search_by_label(db, entity, workspace_id)
    if not nodes:
        return {"answer": f"I couldn't find information about '{entity}' in the knowledge graph.", "sources": []}
    node = nodes[0]
    incoming = kg_edge_repo.get_incoming(db, node.id)
    decisions = decision_repo.search(db, entity, workspace_id)
    relevant_info = []
    for d in decisions[:3]:
        relevant_info.append({
            "type": "decision",
            "title": d.title,
            "rationale": d.rationale[:500],
            "status": d.status,
        })
    for e in incoming:
        source = e.source
        if source.node_type == "meeting":
            relevant_info.append({
                "type": "meeting",
                "title": source.label,
                "relationship": e.relationship,
            })
    answer = f"'{node.label}' ({node.node_type}) was created "
    if relevant_info:
        answer += f"based on {len(relevant_info)} related records. "
        answer += f"The key decision was: '{relevant_info[0]['title']}' — {relevant_info[0]['rationale'][:200]}"
    else:
        answer += f"on {node.created_at.strftime('%B %d, %Y')}. No detailed rationale found in the knowledge graph."
    return {"answer": answer, "sources": relevant_info, "node": {"id": node.id, "label": node.label, "type": node.node_type}}


def _answer_who(db: Session, query: str, workspace_id: str | None) -> dict:
    """Find who made decisions about this entity."""
    import re
    match = re.search(r'(?:approved|decided|created|reviewed)\s+(.+?)(?:\?|$)', query)
    entity = match.group(1) if match else query
    decisions = decision_repo.search(db, entity, workspace_id)
    if not decisions:
        return {"answer": f"No decisions found related to '{entity}'.", "sources": []}
    d = decisions[0]
    answer = f"'{d.title}' (status: {d.status}) was created by user {d.created_by[:8]} on {d.created_at.strftime('%B %d, %Y')}."
    return {"answer": answer, "sources": [{"title": d.title, "status": d.status, "created_by": d.created_by, "created_at": d.created_at.isoformat()}]}


def _answer_when(db: Session, query: str, workspace_id: str | None) -> dict:
    """Find when something happened."""
    import re
    match = re.search(r'when\s+(?:was|did)\s+(.+?)(?:\?|$)', query)
    entity = match.group(1) if match else query
    nodes = kg_node_repo.search_by_label(db, entity, workspace_id)
    if not nodes:
        decisions = decision_repo.search(db, entity, workspace_id)
        if decisions:
            d = decisions[0]
            return {"answer": f"'{d.title}' was created on {d.created_at.strftime('%B %d, %Y at %H:%M UTC')}.", "sources": [{"title": d.title, "date": d.created_at.isoformat()}]}
        return {"answer": f"I couldn't find timing information about '{entity}'.", "sources": []}
    n = nodes[0]
    return {"answer": f"'{n.label}' ({n.node_type}) was created on {n.created_at.strftime('%B %d, %Y at %H:%M UTC')} and last updated on {n.updated_at.strftime('%B %d, %Y at %H:%M UTC')}.", "sources": [{"label": n.label, "type": n.node_type, "created_at": n.created_at.isoformat()}]}


def _answer_dependency(db: Session, query: str, workspace_id: str | None) -> dict:
    """Find which documents/APIs/features depend on something."""
    import re
    match = re.search(r'(?:depends on|affects|related to|references?)\s+(.+?)(?:\?|$)', query)
    entity = match.group(1) if match else query
    # Also try: which X (depends on | affects) Y
    which_match = re.search(r'which\s+(.+?)\s+(?:depends?|affects?)\s+(.+?)(?:\?|$)', query)
    if which_match:
        entity = which_match.group(2)
    nodes = kg_node_repo.search_by_label(db, entity, workspace_id)
    if not nodes:
        return {"answer": f"No nodes found for '{entity}' in the knowledge graph.", "sources": []}
    analysis = kg_edge_repo.impact_analysis(db, nodes[0].id)
    outgoing = analysis.get("outgoing", [])
    incoming = analysis.get("incoming", [])
    answer_parts = [f"'{nodes[0].label}' has {len(incoming)} incoming and {len(outgoing)} outgoing relationships."]
    if outgoing:
        deps = [f"'{o['target'].label}' ({o['relationship']})" for o in outgoing[:5]]
        answer_parts.append(f"Depends on: {'; '.join(deps)}")
    if incoming:
        affs = [f"'{i['source'].label}' ({i['relationship']})" for i in incoming[:5]]
        answer_parts.append(f"Affected by: {'; '.join(affs)}")
    return {"answer": " ".join(answer_parts), "sources": outgoing + incoming}


def _answer_what_changed(db: Session, query: str, workspace_id: str | None) -> dict:
    """Find what changed after a meeting or decision."""
    import re
    match = re.search(r'changed\s+(?:after|since)\s+(.+?)(?:\?|$)', query)
    entity = match.group(1) if match else query
    nodes = kg_node_repo.search_by_label(db, entity, workspace_id)
    if not nodes:
        return {"answer": f"No records found for '{entity}'.", "sources": []}
    connected = kg_node_repo.find_connected(db, nodes[0].id, max_depth=2)
    changes = [n for n in connected["nodes"] if n.id != nodes[0].id and n.node_type not in ("meeting", "decision")]
    if not changes:
        return {"answer": f"No changes found downstream of '{entity}'.", "sources": []}
    return {
        "answer": f"After '{entity}', {len(changes)} items were created or modified: {'; '.join(f"'{n.label}' ({n.node_type})" for n in changes[:5])}.",
        "sources": [{"id": n.id, "label": n.label, "type": n.node_type} for n in changes],
    }


def _answer_explain(db: Session, query: str, workspace_id: str | None) -> dict:
    """Explain what something is and its context."""
    import re
    match = re.search(r'(?:explain|what is|describe)\s+(.+?)(?:\?|$)', query)
    entity = match.group(1) if match else query
    nodes = kg_node_repo.search_by_label(db, entity, workspace_id)
    if not nodes:
        return {"answer": f"I don't have knowledge about '{entity}' in this workspace.", "sources": []}
    n = nodes[0]
    props = n.properties or {}
    connected = kg_node_repo.find_connected(db, n.id, max_depth=1)
    related = []
    for e in connected.get("edges", [])[:5]:
        related.append(f"{e.source.label} → [{e.relationship}] → {e.target.label}")
    answer = f"**{n.label}** (type: {n.node_type})"
    if props.get("description"):
        answer += f": {props['description']}"
    if related:
        answer += f"\n\nConnected to: {'; '.join(related)}"
    return {"answer": answer, "sources": [{"id": n.id, "label": n.label, "type": n.node_type, "properties": props}], "related": related}


def _semantic_search(db: Session, query: str, workspace_id: str | None) -> dict:
    """Default: search across all knowledge sources."""
    nodes = kg_node_repo.search_by_label(db, query, workspace_id, limit=5)
    decisions = decision_repo.search(db, query, workspace_id, limit=3)
    memories = memory_repo.search_semantic(db, query, limit=3)
    sources = []
    sources.extend({"type": "node", "label": n.label, "node_type": n.node_type} for n in nodes)
    sources.extend({"type": "decision", "title": d.title, "status": d.status} for d in decisions)
    sources.extend({"type": "memory", "key": m.key, "content": m.content[:200]} for m in memories)
    if not sources:
        return {"answer": f"I searched the knowledge base but found nothing about '{query}'.", "sources": []}
    return {
        "answer": f"Found {len(sources)} relevant results. Nodes: {len(nodes)}, Decisions: {len(decisions)}, Memories: {len(memories)}.",
        "sources": sources,
    }
