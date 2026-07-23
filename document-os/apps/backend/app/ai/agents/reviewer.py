"""Reviewer agent: holistic quality scores + editorial suggestions."""
from sqlalchemy.orm import Session

from app.ai.agents.base import BaseAgent
from app.ai.parsers import parse_review_report
from app.schemas.ai import ReviewReport


class ReviewerAgent(BaseAgent):
    name = "reviewer"

    async def review(
        self,
        db: Session,
        *,
        doc_title: str,
        outline: str,
        sections_dump: str,
        document_id: str | None = None,
    ) -> ReviewReport:
        prompt = "\n".join(
            [
                f"DOCUMENT TITLE: {doc_title}",
                "",
                "OUTLINE:",
                outline,
                "",
                "SECTIONS:",
                sections_dump[:14000],
                "END OF DOCUMENT",
            ]
        )
        return await self.run(
            db,
            user_prompt=prompt,
            parser=parse_review_report,
            document_id=document_id,
        )
