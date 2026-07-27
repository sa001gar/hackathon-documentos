"""Knowledge graph repository with impact analysis queries."""
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.knowledge_graph import KGEdge, KGNode
from app.repositories.base import BaseRepository


class KGNodeRepository(BaseRepository[KGNode]):
    def get_by_type(self, db: Session, node_type: str, workspace_id: str | None = None, limit: int = 100) -> list[KGNode]:
        q = db.query(KGNode).filter(KGNode.node_type == node_type)
        if workspace_id:
            q = q.filter(KGNode.workspace_id == workspace_id)
        return q.order_by(KGNode.created_at.desc()).limit(limit).all()

    def get_by_source(self, db: Session, source_id: str) -> list[KGNode]:
        return db.query(KGNode).filter(KGNode.source_id == source_id).all()

    def search_by_label(self, db: Session, query: str, workspace_id: str | None = None, limit: int = 20) -> list[KGNode]:
        q = db.query(KGNode).filter(KGNode.label.ilike(f"%{query}%"))
        if workspace_id:
            q = q.filter(KGNode.workspace_id == workspace_id)
        return q.order_by(KGNode.created_at.desc()).limit(limit).all()

    def find_connected(self, db: Session, node_id: str, max_depth: int = 3) -> dict:
        """BFS traversal to find all connected nodes up to max_depth."""
        visited_nodes: dict[str, KGNode] = {}
        edges: list[KGEdge] = []
        current_level = {node_id}

        for _ in range(max_depth):
            if not current_level:
                break
            next_level = set()
            edge_results = (
                db.query(KGEdge)
                .filter(
                    or_(
                        KGEdge.source_id.in_(current_level),
                        KGEdge.target_id.in_(current_level),
                    )
                )
                .all()
            )
            for e in edge_results:
                edges.append(e)
                src = db.get(KGNode, e.source_id)
                tgt = db.get(KGNode, e.target_id)
                if src:
                    visited_nodes[src.id] = src
                if tgt:
                    visited_nodes[tgt.id] = tgt
                next_level.add(e.source_id)
                next_level.add(e.target_id)
            current_level = next_level - set(visited_nodes.keys())

        return {"nodes": list(visited_nodes.values()), "edges": edges}


class KGEdgeRepository(BaseRepository[KGEdge]):
    def get_edges_for_node(self, db: Session, node_id: str) -> list[KGEdge]:
        return (
            db.query(KGEdge)
            .filter(or_(KGEdge.source_id == node_id, KGEdge.target_id == node_id))
            .all()
        )

    def get_incoming(self, db: Session, node_id: str, relationship: str | None = None) -> list[KGEdge]:
        q = db.query(KGEdge).filter(KGEdge.target_id == node_id)
        if relationship:
            q = q.filter(KGEdge.relationship == relationship)
        return q.all()

    def get_outgoing(self, db: Session, node_id: str, relationship: str | None = None) -> list[KGEdge]:
        q = db.query(KGEdge).filter(KGEdge.source_id == node_id)
        if relationship:
            q = q.filter(KGEdge.relationship == relationship)
        return q.all()

    def impact_analysis(self, db: Session, node_id: str) -> dict:
        """Find everything that affects or is affected by this node."""
        node = db.get(KGNode, node_id)
        if not node:
            return {"node": None, "incoming": [], "outgoing": []}
        incoming = self.get_incoming(db, node_id)
        outgoing = self.get_outgoing(db, node_id)

        def _load_node(nid: str) -> KGNode | None:
            return db.get(KGNode, nid)

        return {
            "node": node,
            "incoming": [
                {"source": _load_node(e.source_id), "target": _load_node(e.target_id), "relationship": e.relationship, "weight": e.weight, "path": []}
                for e in incoming
            ],
            "outgoing": [
                {"source": _load_node(e.source_id), "target": _load_node(e.target_id), "relationship": e.relationship, "weight": e.weight, "path": []}
                for e in outgoing
            ],
        }


kg_node_repo = KGNodeRepository(KGNode)
kg_edge_repo = KGEdgeRepository(KGEdge)
