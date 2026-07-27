"""Impact Analysis: trace what breaks if something changes.

Answers questions like:
- What requirements affect this API?
- What documents depend on this feature?
- What changed after this meeting?
- What breaks if I remove OAuth?
"""
from sqlalchemy.orm import Session

from app.models.knowledge_graph import KGNode
from app.repositories import kg_node_repo, kg_edge_repo


def what_affects(db: Session, node_id: str) -> list[dict]:
    """Find everything that affects the given node (incoming relationships)."""
    node = kg_node_repo.get(db, node_id)
    if not node:
        return []
    edges = kg_edge_repo.get_incoming(db, node_id)
    results = []
    for e in edges:
        source = e.source
        results.append({
            "relationship": e.relationship,
            "source_node": {"id": source.id, "label": source.label, "type": source.node_type},
            "weight": e.weight,
            "properties": e.properties,
        })
    return results


def what_depends_on(db: Session, node_id: str) -> list[dict]:
    """Find everything that depends on the given node (outgoing relationships)."""
    node = kg_node_repo.get(db, node_id)
    if not node:
        return []
    edges = kg_edge_repo.get_outgoing(db, node_id)
    results = []
    for e in edges:
        target = e.target
        results.append({
            "relationship": e.relationship,
            "target_node": {"id": target.id, "label": target.label, "type": target.node_type},
            "weight": e.weight,
            "properties": e.properties,
        })
    return results


def breakage_analysis(db: Session, node_id: str) -> dict:
    """Full impact: what breaks if I remove/change this node?"""
    node = kg_node_repo.get(db, node_id)
    if not node:
        return {"error": "Node not found"}
    affects = what_affects(db, node_id)
    depends = what_depends_on(db, node_id)
    connected = kg_node_repo.find_connected(db, node_id, max_depth=2)
    return {
        "target_node": {"id": node.id, "label": node.label, "type": node.node_type},
        "what_affects_it": affects,
        "what_depends_on_it": depends,
        "connected_nodes": [
            {"id": n.id, "label": n.label, "type": n.node_type} for n in connected["nodes"]
        ],
        "connected_edges": [
            {"source": e.source_id, "target": e.target_id, "relationship": e.relationship}
            for e in connected["edges"]
        ],
        "impact_summary": _summarize_impact(node, affects, depends),
    }


def _summarize_impact(node: KGNode, affects: list, depends: list) -> str:
    parts = []
    if not affects and not depends:
        return "This node is isolated — no dependencies detected."
    if affects:
        types = {}
        for a in affects:
            t = a["source_node"]["type"]
            types[t] = types.get(t, 0) + 1
        parts.append(f"Influenced by {sum(types.values())} items: {', '.join(f'{v} {k}s' for k, v in types.items())}")
    if depends:
        types = {}
        for d in depends:
            t = d["target_node"]["type"]
            types[t] = types.get(t, 0) + 1
        parts.append(f"Impacts {sum(types.values())} items: {', '.join(f'{v} {k}s' for k, v in types.items())}")
    return " | ".join(parts)
