"""Orchestration API — LangGraph workflow execution and management."""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.ai.orchestration.graph import run_workflow, resume_workflow
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.ai.specialists import list_specialists, get_specialist

logger = logging.getLogger("documentos.orchestration.api")

router = APIRouter(tags=["orchestration"])


@router.post("/run")
async def run_orchestration(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run a full orchestration workflow with the LangGraph pipeline."""
    result = await run_workflow(
        db,
        user_prompt=data.get("prompt", ""),
        user_id=current_user.id,
        project_id=data.get("project_id"),
        workspace_id=data.get("workspace_id"),
        document_id=data.get("document_id"),
        thread_id=data.get("thread_id", f"thread_{current_user.id}"),
    )
    return result


@router.post("/resume")
async def resume_orchestration(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    """Resume a workflow paused at human approval gate."""
    result = await resume_workflow(
        thread_id=data.get("thread_id", f"thread_{current_user.id}"),
        feedback=data.get("feedback"),
        approved=data.get("approved", False),
    )
    return result


@router.get("/specialists")
def list_all_specialists():
    """List all available AI specialists with their capabilities."""
    specialists = []
    for s in list_specialists():
        specialists.append({
            "name": s.name,
            "display_name": s.display_name,
            "description": s.description,
            "capabilities": [{"name": c.name, "description": c.description} for c in s.capabilities],
            "tools": s.tools,
            "responsibilities": s.responsibilities,
            "icon": s.icon,
        })
    return {"specialists": specialists, "count": len(specialists)}


@router.get("/specialists/{name}")
def get_specialist_detail(name: str):
    """Get details for a specific AI specialist."""
    spec = get_specialist(name)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Specialist '{name}' not found")
    return {
        "name": spec.name,
        "display_name": spec.display_name,
        "description": spec.description,
        "system_prompt": spec.system_prompt,
        "capabilities": [{"name": c.name, "description": c.description} for c in spec.capabilities],
        "tools": spec.tools,
        "memory_scopes": spec.memory_scopes,
        "context_requirements": spec.context_requirements,
        "responsibilities": spec.responsibilities,
        "temperature": spec.temperature,
        "max_tokens": spec.max_tokens,
        "icon": spec.icon,
    }
