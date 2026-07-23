"""Planner Agent: user intent -> hierarchical document outline (JSON tree)."""
import json
import logging

from app.ai.agents.base import AgentParseError, BaseAgent
from app.ai.schemas import PlanOutput
from app.schemas.ai import PlanNode

logger = logging.getLogger("documentos.ai.planner")

MAX_DEPTH = 2
MAX_SECTIONS = 12


class PlannerAgent(BaseAgent):
    name = "planner"

    async def run(
        self,
        *,
        user_prompt: str,
        doc_type: str = "general",
        template_outline: list[dict] | None = None,
        title_hint: str = "",
    ) -> PlanOutput:
        prompt_parts = [
            f"USER REQUEST: {user_prompt}",
            f"DOCUMENT TYPE: {doc_type}",
            f"TITLE HINT: {title_hint or '(none)'}",
        ]
        if template_outline:
            prompt_parts.append(
                "TEMPLATE OUTLINE (JSON):\n"
                + json.dumps(template_outline, indent=2)
                + "\nEND TEMPLATE"
            )
        prompt = "\n".join(prompt_parts)

        response = await self.engine.generate(
            agent=self.name, system=self.system_prompt, prompt=prompt, temperature=0.3
        )
        try:
            plan = self.parse_json(response.text, PlanOutput)
            plan.sections = [self._sanitize(n, 0) for n in plan.sections[:MAX_SECTIONS]]
            plan.sections = [s for s in plan.sections if s.title.strip()]
            if not plan.sections:
                raise AgentParseError("planner returned zero sections")
            plan.title = plan.title.strip() or title_hint or "Untitled Document"
            return plan
        except AgentParseError as exc:
            logger.warning("Planner parse failed (%s); using fallback outline.", exc)
            return self._fallback(user_prompt, doc_type, template_outline, title_hint)

    def _sanitize(self, node: PlanNode, depth: int) -> PlanNode:
        node.title = node.title.strip() or "Untitled Section"
        if depth >= MAX_DEPTH:
            node.children = []
        else:
            node.children = [self._sanitize(c, depth + 1) for c in node.children[:6]]
        return node

    def _fallback(
        self, user_prompt: str, doc_type: str, template_outline: list[dict] | None, title_hint: str
    ) -> PlanOutput:
        title = title_hint or self._titleize(user_prompt)
        if template_outline:
            return PlanOutput(title=title, sections=[self._from_template(n) for n in template_outline])
        return PlanOutput(
            title=title,
            sections=[
                PlanNode(title="Introduction", prompt=f"Introduce {title}."),
                PlanNode(title="Overview", prompt=f"Give an overview of {title}."),
                PlanNode(title="Details", prompt=f"Detail the core content of {title}."),
                PlanNode(title="Conclusion", prompt=f"Conclude {title} with next steps."),
            ],
        )

    @staticmethod
    def _from_template(node: dict) -> PlanNode:
        return PlanNode(
            title=node.get("title", "Section"),
            prompt=node.get("prompt", ""),
            children=[PlannerAgent._from_template(c) for c in node.get("children", [])],
        )

    @staticmethod
    def _titleize(text: str) -> str:
        short = " ".join(text.strip().split()[:8])
        return short[:1].upper() + short[1:] if short else "Untitled Document"
