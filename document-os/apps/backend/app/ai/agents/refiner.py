"""Refiner Agent: transforms exactly the selected text. Nothing else."""
from app.ai.agents.base import BaseAgent
from app.ai.prompts import REFINE_ACTION_INSTRUCTIONS


class RefinerAgent(BaseAgent):
    name = "refiner"

    async def run(
        self,
        *,
        text: str,
        action: str,
        doc_title: str = "",
        section_title: str = "",
        target_language: str = "English",
        extra_instructions: str = "",
        document_id: str | None = None,
        section_id: str | None = None,
    ) -> str:
        instruction = REFINE_ACTION_INSTRUCTIONS.get(
            action, REFINE_ACTION_INSTRUCTIONS["improve"]
        ).format(target_language=target_language)
        prompt = "\n".join([
            f"ACTION: {action}",
            f"INSTRUCTION: {instruction}",
            f"DOCUMENT TITLE: {doc_title or '(unknown)'}",
            f"SECTION TITLE: {section_title or '(unknown)'}",
            f"TARGET LANGUAGE: {target_language}",
            f"EXTRA INSTRUCTIONS: {extra_instructions or '(none)'}",
            "",
            "TEXT START",
            text,
            "TEXT END",
            "",
            "Return ONLY the transformed text.",
        ])
        response = await self.engine.generate(
            agent=self.name,
            system=self.system_prompt,
            prompt=prompt,
            temperature=0.35,
            document_id=document_id,
            section_id=section_id,
        )
        return self.strip_fences(response.text).strip()
