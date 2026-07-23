"""Reviewer Agent: quality scores + actionable suggestions."""
import logging
import re

from app.ai.agents.base import AgentParseError, BaseAgent
from app.ai.schemas import ReviewOutput

logger = logging.getLogger("documentos.ai.reviewer")


class ReviewerAgent(BaseAgent):
    name = "reviewer"

    async def run(
        self,
        *,
        doc_title: str,
        doc_type: str,
        full_markdown: str,
        total_sections: int,
        filled_sections: int,
        document_id: str | None = None,
    ) -> ReviewOutput:
        prompt = "\n".join([
            f"DOCUMENT TITLE: {doc_title}",
            f"DOCUMENT TYPE: {doc_type}",
            f"SECTIONS FILLED: {filled_sections}/{total_sections}",
            "",
            "DOCUMENT MARKDOWN:",
            full_markdown[:16000],
            "END DOCUMENT",
        ])
        try:
            response = await self.engine.generate(
                agent=self.name, system=self.system_prompt, prompt=prompt,
                temperature=0.2, document_id=document_id,
            )
            return self.parse_json(response.text, ReviewOutput)
        except AgentParseError as exc:
            logger.warning("Reviewer parse failed (%s); using heuristic review.", exc)
            return self._heuristic(full_markdown, total_sections, filled_sections)

    @staticmethod
    def _heuristic(markdown: str, total: int, filled: int) -> ReviewOutput:
        words = len(markdown.split())
        sentences = max(len(re.findall(r"[.!?]\s", markdown)), 1)
        avg_sentence = words / sentences
        readability = max(30, min(95, int(100 - abs(avg_sentence - 18) * 2)))
        completeness = int((filled / max(total, 1)) * 100)
        score = int(readability * 0.45 + completeness * 0.45 + min(words / 20, 10))
        return ReviewOutput(
            score=min(score, 100),
            readability=readability,
            completeness=completeness,
            confidence=0.6,
            summary=(
                f"Heuristic review: {words} words across {filled}/{total} sections. "
                f"Average sentence length is {avg_sentence:.0f} words."
            ),
            suggestions=[
                "Fill any remaining empty sections to raise completeness.",
                "Keep sentences under 25 words for better readability.",
                "Add tables or lists to break up long paragraphs.",
            ],
        )
