"""Knowledge Graph service: manage nodes, edges, relationships, and impact analysis."""
from sqlalchemy.orm import Session

from app.models.knowledge_graph import KGNode
from app.repositories import kg_node_repo, kg_edge_repo
from app.schemas.knowledge_graph import KGNodeCreate, KGEdgeCreate, KGNodeUpdate


def create_node(db: Session, data: KGNodeCreate) -> KGNode:
    return kg_node_repo.create(db, obj_in=data.model_dump())


def get_node(db: Session, node_id: str) -> KGNode | None:
    return kg_node_repo.get(db, node_id)


def update_node(db: Session, db_obj: KGNode, data: KGNodeUpdate) -> KGNode:
    return kg_node_repo.update(db, db_obj=db_obj, obj_in=data.model_dump(exclude_unset=True))


def get_or_create_node(db: Session, data: KGNodeCreate) -> KGNode:
    existing = None
    if data.source_id and data.node_type:
        nodes = kg_node_repo.get_by_source(db, data.source_id)
        existing = next((n for n in nodes if n.node_type == data.node_type), None)
    if existing:
        return kg_node_repo.update(db, db_obj=existing, obj_in={"label": data.label, "properties": data.properties})
    return create_node(db, data)


def connect_nodes(db: Session, data: KGEdgeCreate) -> None:
    existing = kg_edge_repo.get_incoming(db, data.target_id, data.relationship)
    already = any(e.source_id == data.source_id for e in existing)
    if not already:
        kg_edge_repo.create(db, obj_in=data.model_dump())


def impact_analysis(db: Session, node_id: str) -> dict:
    return kg_edge_repo.impact_analysis(db, node_id)


def search_nodes(db: Session, query: str, workspace_id: str | None = None, limit: int = 20) -> list[KGNode]:
    return kg_node_repo.search_by_label(db, query, workspace_id, limit)


def get_subgraph(db: Session, node_id: str, depth: int = 2) -> dict:
    return kg_node_repo.find_connected(db, node_id, depth)


def get_workspace_graph(db: Session, workspace_id: str, limit: int = 100) -> list[KGNode]:
    return db.query(KGNode).filter(KGNode.workspace_id == workspace_id).order_by(KGNode.created_at.desc()).limit(limit).all()
