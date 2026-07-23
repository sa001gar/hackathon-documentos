"""Validator Agent: deterministic checks + Gemma audit -> structured issues."""
import logging
import re

from app.ai.agents.base import AgentParseError, BaseAgent
from app.ai.schemas import ValidationOutput
from app.schemas.ai import ValidationIssue

logger = logging.getLogger("documentos.ai.validator")


class ValidatorAgent(BaseAgent):
    name = "validator"

    async def run(
        self,
        *,
        doc_title: str,
        full_markdown: str,
        outline_titles: list[str],
        empty_sections: list[str],
        document_id: str | None = None,
    ) -> ValidationOutput:
        prompt = "\n".join([
            f"DOCUMENT TITLE: {doc_title}",
            f"EXPECTED SECTIONS: {', '.join(outline_titles)}",
            "",
            "DOCUMENT MARKDOWN:",
            full_markdown[:16000],
            "END DOCUMENT",
        ])
        ai_issues: list[ValidationIssue] = []
        try:
            response = await self.engine.generate(
                agent=self.name, system=self.system_prompt, prompt=prompt,
                temperature=0.1, document_id=document_id,
            )
            output = self.parse_json(response.text, ValidationOutput)
            ai_issues = output.issues
        except AgentParseError as exc:
            logger.warning("Validator parse failed (%s); keeping deterministic checks only.", exc)

        issues = self._deterministic_checks(full_markdown, empty_sections) + ai_issues
        passed = not any(i.severity == "error" for i in issues)
        return ValidationOutput(passed=passed, issues=issues)

    @staticmethod
    def _deterministic_checks(
        full_markdown: str, empty_sections: list[str]
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []

        for title in empty_sections:
            issues.append(ValidationIssue(
                type="missing_section", severity="error", section=title,
                message=f"Section '{title}' has no content yet.",
                suggestion="Generate or write content for this section.",
            ))

        # duplicated long paragraphs across the document
        seen: dict[str, int] = {}
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", full_markdown) if len(p.strip()) > 120]
        for p in paragraphs:
            key = re.sub(r"\s+", " ", p.lower())
            seen[key] = seen.get(key, 0) + 1
        if any(count > 1 for count in seen.values()):
            issues.append(ValidationIssue(
                type="duplicate", severity="warning",
                message="Identical long paragraphs appear more than once in the document.",
                suggestion="Consolidate duplicated content into a single section.",
            ))

        # broken markdown links / references
        for m in re.finditer(r"\[([^\]]+)\]\(\s*\)", full_markdown):
            issues.append(ValidationIssue(
                type="reference", severity="warning",
                message=f"Link '{m.group(1)}' has an empty target.",
                suggestion="Add a URL or remove the link syntax.",
            ))

        # placeholder markers left in text
        for marker in ("TODO", "TBD", "FIXME", "XXX"):
            if re.search(rf"\b{marker}\b", full_markdown):
                issues.append(ValidationIssue(
                    type="formatting", severity="info",
                    message=f"Placeholder marker '{marker}' found in the document.",
                    suggestion="Resolve or remove placeholder markers before export.",
                ))
        return issues
