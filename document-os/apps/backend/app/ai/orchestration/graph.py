"""LangGraph orchestration graph — the brain of DocOS.

Workflow:
  User Request
     ↓
  Intent Router  ──→  Planner  ──→  Knowledge Retrieval
                                        ↓
                                  Research Agent
                                        ↓
                                    Writer
                                        ↓
                              Compliance Checker
                                        ↓
                               Security Checker
                                        ↓
                                 Fact Verification
                                        ↓
                                    Reviewer
                                        ↓
                              Style Harmonizer
                                        ↓
                               Human Approval ──→ Publish
                                        ↑
                                   Feedback Loop

Every node is replaceable. Supports checkpoints, branching, retries,
parallel execution, and human-in-the-loop approval.
"""
import logging
from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph, START
from langgraph.types import Command
from sqlalchemy.orm import Session

from app.ai.orchestration.nodes import (
    compliance_checker,
    context_retriever,
    fact_checker,
    human_approval,
    intent_router,
    planner_node,
    publish,
    research_agent,
    reviewer_node,
    security_checker,
    style_harmonizer,
    writer_agent,
)
from app.ai.orchestration.state import GraphState
from app.services.context_engine import build_full_context

logger = logging.getLogger("documentos.orchestration.graph")


def create_orchestration_graph() -> StateGraph:
    """Build the LangGraph orchestration state graph."""
    builder = StateGraph(GraphState)

    # Register all nodes
    builder.add_node("intent_router", intent_router)
    builder.add_node("context_retriever", context_retriever)
    builder.add_node("planner", planner_node)
    builder.add_node("research", research_agent)
    builder.add_node("writer", writer_agent)
    builder.add_node("compliance_checker", compliance_checker)
    builder.add_node("security_checker", security_checker)
    builder.add_node("fact_checker", fact_checker)
    builder.add_node("reviewer", reviewer_node)
    builder.add_node("style_harmonizer", style_harmonizer)
    builder.add_node("human_approval", human_approval)
    builder.add_node("publish", publish)

    # Define the main flow
    builder.add_edge(START, "intent_router")
    builder.add_edge("intent_router", "context_retriever")
    builder.add_edge("context_retriever", "planner")
    builder.add_edge("planner", "research")
    builder.add_edge("research", "writer")
    builder.add_edge("writer", "compliance_checker")
    builder.add_edge("compliance_checker", "security_checker")
    builder.add_edge("security_checker", "fact_checker")
    builder.add_edge("fact_checker", "reviewer")
    builder.add_edge("reviewer", "style_harmonizer")

    # Human approval gate — supports branching
    builder.add_conditional_edges(
        "style_harmonizer",
        human_approval,
        {
            "publish": "publish",
            "human_feedback": "human_approval",
        },
    )

    builder.add_edge("publish", END)

    # Configure checkpointer for resumable workflows
    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer, interrupt_before=["human_approval"])

    return graph


_orchestration_graph: StateGraph | None = None


def get_orchestration_graph() -> StateGraph:
    global _orchestration_graph
    if _orchestration_graph is None:
        _orchestration_graph = create_orchestration_graph()
    return _orchestration_graph


async def run_workflow(
    db: Session,
    *,
    user_prompt: str,
    user_id: str | None = None,
    project_id: str | None = None,
    workspace_id: str | None = None,
    document_id: str | None = None,
    thread_id: str = "default",
) -> dict[str, Any]:
    """Execute a full orchestration workflow and return results.

    Context is pre-loaded from the knowledge graph and memory before
    entering the LangGraph pipeline.
    """
    graph = get_orchestration_graph()
    config = {"configurable": {"thread_id": thread_id}}

    # Pre-load context from all sources
    context = build_full_context(
        db,
        user_id=user_id,
        project_id=project_id,
        workspace_id=workspace_id,
        document_id=document_id,
        query=user_prompt,
    )

    initial_state = GraphState(
        user_prompt=user_prompt,
        user_id=user_id,
        project_id=project_id,
        workspace_id=workspace_id,
        document_id=document_id,
        context=context,
    )

    try:
        result = await graph.ainvoke(initial_state, config)
        return {
            "status": "completed",
            "generated_content": result.get("generated_content", ""),
            "intent": result.get("intent", ""),
            "plan": result.get("plan", {}),
            "confidence": result.get("confidence", 1.0),
            "sources": result.get("sources", []),
            "assumptions": result.get("assumptions", []),
            "review": result.get("review_result", {}),
            "compliance": result.get("compliance_result", {}),
            "security": result.get("security_result", {}),
            "fact_check": result.get("fact_check_result", {}),
            "metadata": result.get("run_metadata", {}),
        }
    except Exception as exc:
        logger.exception("Workflow execution failed")
        return {
            "status": "failed",
            "error": str(exc),
            "intent": initial_state.intent,
        }


async def resume_workflow(
    thread_id: str,
    feedback: str | None = None,
    approved: bool = False,
) -> dict[str, Any]:
    """Resume a workflow paused at human approval gate."""
    graph = get_orchestration_graph()
    config = {"configurable": {"thread_id": thread_id}}

    state = graph.get_state(config)
    if state.next:
        command = Command(
            goto="publish" if approved else "style_harmonizer",
            update={"approved": approved, "human_feedback": feedback or ""},
        )
        result = await graph.ainvoke(command, config)
        return {
            "status": "completed",
            "generated_content": result.get("generated_content", ""),
            "approved": approved,
            "feedback": feedback,
        }
    return {"status": "no_pending_approval"}
