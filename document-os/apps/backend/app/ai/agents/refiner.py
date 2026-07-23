"""Refiner agent: transforms exactly the selected text. Nothing else."""
from sqlalchemy.orm import Session

from app.ai.agents.base import BaseAgent
from app.ai.parsers import clean_markdown_output
from app.schemas.ai import RefineAction


class RefinerAgent(BaseAgent):
    name = "refiner"

    async def refine(
        self,
        db: Session,
        *,
        action: RefineAction,
        selected_text: str,
        instruction: str | None = None,
        doc_title: str = "",
        section_title: str = "",
        document_id: str | None = None,
        section_id: str | None = None,
    ) -> str:
        prompt = "\n".join(
            [
                f"ACTION: {action.value}",
                f"CUSTOM INSTRUCTION: {instruction or '(none)'}",
                f"DOCUMENT TITLE: {doc_title or '(unknown)'}",
                f"SECTION TITLE: {section_title or '(unknown)'}",
                f"TARGET LANGUAGE: {instruction if action is RefineAction.translate and instruction else 'English'}",
                "",
                "TEXT START",
                selected_text,
                "TEXT END",
                "",
                "Return ONLY the transformed text.",
            ]
        )
        return await self.run(
            db,
            user_prompt=prompt,
            parser=clean_markdown_output,
            document_id=document_id,
            section_id=section_id,
        )
