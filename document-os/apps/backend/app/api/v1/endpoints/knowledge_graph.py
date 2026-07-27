"""Knowledge Graph API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.repositories import kg_node_repo, kg_edge_repo
from app.schemas.knowledge_graph import (
    ImpactAnalysis,
    KGEdgeCreate,
    KGEdgeRead,
    KGNodeCreate,
    KGNodeRead,
    KGNodeUpdate,
)
from app.services.knowledge_graph_service import (
    connect_nodes,
    create_node,
    get_node,
    get_subgraph,
    get_workspace_graph,
    impact_analysis,
    search_nodes,
    update_node,
)

router = APIRouter(tags=["knowledge-graph"])


@router.post("/nodes", response_model=KGNodeRead, status_code=201)
def create_kg_node(
    data: KGNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_node(db, data)


@router.get("/nodes/{node_id}", response_model=KGNodeRead)
def get_kg_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return kg_node_repo.get(db, node_id)


@router.patch("/nodes/{node_id}", response_model=KGNodeRead)
def update_kg_node(
    node_id: str,
    data: KGNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = kg_node_repo.get(db, node_id)
    if obj:
        return kg_node_repo.update(db, db_obj=obj, obj_in=data.model_dump(exclude_unset=True))
    from app.core.errors import NotFoundError
    raise NotFoundError("Node not found")


@router.delete("/nodes/{node_id}", status_code=204)
def delete_kg_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    kg_node_repo.remove(db, id=node_id)


@router.post("/edges", status_code=201)
def create_kg_edge(
    data: KGEdgeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connect_nodes(db, data)


@router.get("/nodes/search", response_model=list[KGNodeRead])
def search_kg_nodes(
    q: str,
    workspace_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return search_nodes(db, q, workspace_id)


@router.get("/nodes/{node_id}/impact", response_model=ImpactAnalysis)
def node_impact_analysis(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = impact_analysis(db, node_id)
    return {
        "node": result["node"],
        "incoming": result["incoming"],
        "outgoing": result["outgoing"],
    }


@router.get("/nodes/{node_id}/subgraph")
def node_subgraph(
    node_id: str,
    depth: int = 2,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_subgraph(db, node_id, depth)


@router.get("/workspace/{workspace_id}/graph", response_model=list[KGNodeRead])
def workspace_graph(
    workspace_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_workspace_graph(db, workspace_id, limit)
