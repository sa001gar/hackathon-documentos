"""Planner agent: user prompt → hierarchical outline (structured JSON tree)."""
import json

from sqlalchemy.orm import Session

from app.ai.agents.base import BaseAgent
from app.ai.parsers import parse_planner_output
from app.ai.schemas import PlannerOutput

MAX_DEPTH = 3
MAX_CHILDREN = 8


class PlannerAgent(BaseAgent):
    name = "planner"

    def build_user_prompt(self, prompt: str, existing_structure: list[dict] | None) -> str:
        parts = [f"USER REQUEST: {prompt}"]
        if existing_structure:
            parts.append(
                "EXISTING STRUCTURE (respect and refine it, keep titles stable):\n"
                + json.dumps(existing_structure, indent=2)[:6000]
            )
        return "\n\n".join(parts)

    def parse_plan(self, raw_text: str) -> PlannerOutput:
        """Parse raw planner text into a sanitized outline (shared by all paths)."""
        output = parse_planner_output(raw_text)
        output.sections = [self._sanitize(node, 0) for node in output.sections]
        return output

    async def plan(
        self,
        db: Session,
        *,
        prompt: str,
        existing_structure: list[dict] | None = None,
        document_id: str | None = None,
    ) -> PlannerOutput:
        output: PlannerOutput = await self.run(
            db,
            user_prompt=self.build_user_prompt(prompt, existing_structure),
            parser=parse_planner_output,
            document_id=document_id,
        )
        output.sections = [self._sanitize(node, 0) for node in output.sections]
        return output

    def _sanitize(self, node, depth: int):
        node.title = node.title.strip()[:512] or "Untitled Section"
        node.children = [] if depth >= MAX_DEPTH else [self._sanitize(c, depth + 1) for c in node.children[:MAX_CHILDREN]]
        return node
