"""Knowledge Health Score: measure quality of organizational knowledge.

Metrics:
- Outdated docs (docs with no updates in >30 days)
- Missing tests (features without linked test nodes)
- Contradictions (conflicting decisions on same topic)
- Duplicate knowledge (similar memory entries)
- Broken references (edges to non-existent nodes)
- Incomplete requirements (requirements without linked features)
"""
from datetime import datetime, timezone, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Document, DocumentSection
from app.models.knowledge_graph import KGNode, KGEdge
from app.models.memory import MemoryItem
from app.models.decision import Decision


def compute_health_score(db: Session, workspace_id: str) -> dict:
    """Compute all health metrics for a workspace."""
    now = datetime.now(timezone.utc)

    # 1. Outdated docs
    thirty_days_ago = now - timedelta(days=30)
    outdated_docs = (
        db.query(func.count(Document.id))
        .filter(Document.updated_at < thirty_days_ago)
        .scalar()
    ) or 0
    total_docs = (db.query(func.count(Document.id)).scalar()) or 1

    # 2. Missing tests
    feature_nodes = (
        db.query(func.count(KGNode.id))
        .filter(KGNode.node_type == "feature", KGNode.workspace_id == workspace_id)
        .scalar()
    ) or 0
    test_nodes = (
        db.query(func.count(KGNode.id))
        .filter(KGNode.node_type == "test", KGNode.workspace_id == workspace_id)
        .scalar()
    ) or 1
    features_tested = (
        db.query(func.count(KGNode.id))
        .filter(KGNode.id.in_(
            db.query(KGEdge.source_id).filter(
                KGEdge.relationship == "tested_by",
                KGEdge.source_id.in_(
                    db.query(KGNode.id).filter(KGNode.node_type == "feature")
                ),
            )
        ))
        .scalar()
    ) or 0

    # 3. Contradictions
    decision_pairs = (
        db.query(Decision.title, func.count(Decision.id))
        .filter(Decision.workspace_id == workspace_id)
        .group_by(Decision.title)
        .having(func.count(Decision.id) > 1)
        .all()
    )
    contradictions = len(decision_pairs)

    # 4. Duplicate memory
    duplicate_memories = (
        db.query(MemoryItem.key, func.count(MemoryItem.id))
        .filter(MemoryItem.scope == "project")
        .group_by(MemoryItem.key, MemoryItem.scope_id)
        .having(func.count(MemoryItem.id) > 1)
        .all()
    )
    duplicates = len(duplicate_memories)

    # 5. Broken references
    all_edges = db.query(KGEdge).count()
    valid_edges = (
        db.query(func.count(KGEdge.id))
        .filter(
            KGEdge.source_id.in_(db.query(KGNode.id)),
            KGEdge.target_id.in_(db.query(KGNode.id)),
        )
        .scalar()
    ) or 0
    broken_refs = all_edges - valid_edges

    # 6. Incomplete requirements
    reqs_without_features = 0
    if feature_nodes > 0:
        reqs = db.query(KGNode).filter(
            KGNode.node_type == "requirement",
            KGNode.workspace_id == workspace_id,
        ).count()
        reqs_linked = (
            db.query(func.count(KGNode.id))
            .filter(
                KGNode.node_type == "requirement",
                KGNode.id.in_(
                    db.query(KGEdge.source_id).filter(KGEdge.relationship == "implements")
                ),
            )
            .scalar()
        ) or 0
        reqs_without_features = reqs - reqs_linked

    # Compute scores (0-100)
    outdated_score = max(0, 100 - int((outdated_docs / max(total_docs, 1)) * 100))

    if feature_nodes > 0 and test_nodes > 0:
        test_coverage = min(100, int((features_tested / max(feature_nodes, 1)) * 100))
    else:
        test_coverage = 100 if feature_nodes == 0 and test_nodes == 0 else 50
    contradiction_penalty = max(0, 100 - contradictions * 20)
    duplicate_penalty = max(0, 100 - duplicates * 15)
    ref_health = max(0, 100 - int((broken_refs / max(all_edges, 1)) * 100)) if all_edges > 0 else 100
    completeness = max(0, 100 - reqs_without_features * 10)

    overall = int(
        outdated_score * 0.2
        + test_coverage * 0.2
        + contradiction_penalty * 0.15
        + duplicate_penalty * 0.15
        + ref_health * 0.15
        + completeness * 0.15
    )

    return {
        "overall_score": overall,
        "metrics": {
            "outdated_docs": {"score": outdated_score, "value": outdated_docs, "total": total_docs},
            "test_coverage": {"score": test_coverage, "value": features_tested, "total": feature_nodes},
            "contradictions": {"score": contradiction_penalty, "value": contradictions},
            "duplicate_knowledge": {"score": duplicate_penalty, "value": duplicates},
            "broken_references": {"score": ref_health, "value": broken_refs, "total": all_edges},
            "requirement_completeness": {"score": completeness, "value": reqs_without_features},
        },
        "grade": _grade(overall),
        "recommendations": _recommendations(
            outdated_score < 70, test_coverage < 70, contradictions > 0,
            duplicates > 0, broken_refs > 0, reqs_without_features > 0,
        ),
    }


def _grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _recommendations(
    outdated: bool, untested: bool, contradictions: bool,
    duplicates: bool, broken_refs: bool, incomplete: bool,
) -> list[str]:
    recs = []
    if outdated:
        recs.append("Review and update documents that haven't been modified in 30+ days")
    if untested:
        recs.append("Connect features to their test nodes in the knowledge graph")
    if contradictions:
        recs.append("Resolve conflicting decisions on the same topic")
    if duplicates:
        recs.append("Merge duplicate knowledge entries across projects")
    if broken_refs:
        recs.append("Fix broken references in the knowledge graph edges")
    if incomplete:
        recs.append("Link requirements to their implementing features")
    if not recs:
        recs.append("Knowledge is in good health — keep it up!")
    return recs
