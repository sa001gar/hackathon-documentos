"""Writer Agent: generates ONE section of Markdown. Never the whole document."""
from app.ai.agents.base import BaseAgent


class WriterAgent(BaseAgent):
    name = "writer"

    async def run(
        self,
        *,
        doc_title: str,
        doc_type: str,
        section_title: str,
        section_prompt: str,
        breadcrumb: list[str] | None = None,
        tone: str = "professional",
        extra_instructions: str = "",
        document_id: str | None = None,
        section_id: str | None = None,
    ) -> str:
        path = " > ".join(breadcrumb or [section_title])
        prompt = "\n".join([
            f"DOCUMENT TITLE: {doc_title}",
            f"DOCUMENT TYPE: {doc_type}",
            f"SECTION PATH: {path}",
            f"SECTION TITLE: {section_title}",
            f"SECTION GOAL: {section_prompt or f'Write the {section_title} section.'}",
            f"TONE: {tone}",
            f"EXTRA INSTRUCTIONS: {extra_instructions or '(none)'}",
            "",
            "Write the section content now (Markdown, no heading for the section itself).",
        ])
        response = await self.engine.generate(
            agent=self.name,
            system=self.system_prompt,
            prompt=prompt,
            temperature=0.55,
            document_id=document_id,
            section_id=section_id,
        )
        return self.strip_fences(response.text)
