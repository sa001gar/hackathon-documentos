"""Writer agent: writes exactly ONE section, in context. Markdown out."""
from sqlalchemy.orm import Session

from app.ai.agents.base import BaseAgent
from app.ai.parsers import clean_markdown_output
from app.ai.schemas import SectionContext


class WriterAgent(BaseAgent):
    name = "writer"

    def build_user_prompt(self, context: SectionContext) -> str:
        return "\n".join(
            [
                f"DOCUMENT TITLE: {context.document_title}",
                f"DOCUMENT DESCRIPTION: {context.document_description or '(none)'}",
                "",
                "DOCUMENT OUTLINE:",
                context.outline or "(no outline)",
                "",
                f"SECTION PATH: {context.section_path or context.section_title}",
                f"SECTION TITLE: {context.section_title}",
                f"SECTION GOAL: {context.brief or f'Write the {context.section_title} section.'}",
                f"EXTRA INSTRUCTIONS: {context.instructions or '(none)'}",
                "",
                "Write the section content now (Markdown only, no heading for the section itself).",
            ]
        )

    async def write(
        self,
        db: Session,
        *,
        context: SectionContext,
        document_id: str | None = None,
        section_id: str | None = None,
    ) -> str:
        return await self.run(
            db,
            user_prompt=self.build_user_prompt(context),
            parser=clean_markdown_output,
            document_id=document_id,
            section_id=section_id,
        )
