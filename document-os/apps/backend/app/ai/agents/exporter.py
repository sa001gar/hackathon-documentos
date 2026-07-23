"""Exporter agent: executive summary for export front matter."""
from sqlalchemy.orm import Session

from app.ai.agents.base import BaseAgent
from app.ai.parsers import clean_markdown_output


class ExporterAgent(BaseAgent):
    name = "exporter"

    async def summarize(
        self,
        db: Session,
        *,
        doc_title: str,
        outline: str,
        sections_dump: str,
        document_id: str | None = None,
    ) -> str:
        prompt = "\n".join(
            [
                f"DOCUMENT TITLE: {doc_title}",
                "",
                "OUTLINE:",
                outline,
                "",
                "CONTENT:",
                sections_dump[:10000],
                "END OF DOCUMENT",
            ]
        )
        return await self.run(
            db,
            user_prompt=prompt,
            parser=clean_markdown_output,
            document_id=document_id,
        )
