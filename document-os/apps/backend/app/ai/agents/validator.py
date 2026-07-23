"""Validator agent: outline + content → structured issue report."""
from sqlalchemy.orm import Session

from app.ai.agents.base import BaseAgent
from app.ai.parsers import parse_validation_report


class ValidatorAgent(BaseAgent):
    name = "validator"

    async def validate(
        self,
        db: Session,
        *,
        doc_title: str,
        outline: str,
        sections_dump: str,
        document_id: str | None = None,
    ) -> tuple[bool, str, list[dict]]:
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
            parser=parse_validation_report,
            document_id=document_id,
        )
