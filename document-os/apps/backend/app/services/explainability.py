"""Explainable AI: provenance tracking for every AI generation.

Every AI response should answer:
- Why was this generated?
- What sources were used?
- Which previous decisions influenced this?
- What assumptions were made?
- How confident is the result?
- Which requirements are satisfied?
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.ai import AILog
from app.repositories import ai_log_repo, kg_node_repo, kg_edge_repo


def record_ai_run(
    db: Session,
    *,
    agent: str,
    action: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response: str,
    document_id: str | None = None,
    section_id: str | None = None,
    latency_ms: int = 0,
    status: str = "success",
    error: str | None = None,
    sources: list[dict] | None = None,
    assumptions: list[str] | None = None,
    confidence: float | None = None,
    requirements_satisfied: list[str] | None = None,
    decisions_influenced: list[str] | None = None,
) -> AILog:
    """Record an AI run with full provenance."""
    provenance = {
        "sources": sources or [],
        "assumptions": assumptions or [],
        "confidence": confidence,
        "requirements_satisfied": requirements_satisfied or [],
        "decisions_influenced": decisions_influenced or [],
    }
    log = ai_log_repo.create_log(
        db,
        document_id=document_id,
        section_id=section_id,
        agent=agent,
        action=action,
        model=model,
        system_prompt=system_prompt[:8000],
        user_prompt=user_prompt[:8000],
        response=response[:8000],
        latency_ms=latency_ms,
        status=status,
        error=error,
    )
    return log


def get_explainability(db: Session, log_id: str | None = None, document_id: str | None = None) -> dict | None:
    """Retrieve explainability data for an AI run."""
    if log_id:
        log = ai_log_repo.get(db, log_id)
    elif document_id:
        logs = (
            db.query(AILog)
            .filter(AILog.document_id == document_id)
            .order_by(AILog.created_at.desc())
            .limit(10)
            .all()
        )
        if not logs:
            return None
        return {
            "runs": [
                {
                    "id": l.id,
                    "agent": l.agent,
                    "action": l.action,
                    "model": l.model,
                    "latency_ms": l.latency_ms,
                    "status": l.status,
                    "created_at": l.created_at.isoformat(),
                    "prompt_summary": l.user_prompt[:200] if l.user_prompt else "",
                    "response_summary": l.response[:200] if l.response else "",
                }
                for l in logs
            ]
        }
    else:
        return None
    if not log:
        return None
    return {
        "id": log.id,
        "agent": log.agent,
        "action": log.action,
        "model": log.model,
        "status": log.status,
        "error": log.error,
        "latency_ms": log.latency_ms,
        "created_at": log.created_at.isoformat(),
        "system_prompt": log.system_prompt,
        "user_prompt": log.user_prompt,
        "response": log.response,
    }
