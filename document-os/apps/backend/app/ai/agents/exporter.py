"""Exporter Agent: composes the final Markdown artifact from the section tree.

Deterministic by design: exporting must be reproducible and instant.
(Format conversion to HTML/DOCX/PDF lives in services/export.py.)
"""
from app.ai.agents.base import BaseAgent
from app.models import Document, DocumentSection
from app.utils.markdown import assemble_markdown, word_count


class ExporterAgent(BaseAgent):
    name = "exporter"
    system_prompt = ""  # no LLM call needed

    def compose(
        self, document: Document, sections: list[DocumentSection], include_toc: bool = True
    ) -> tuple[str, dict]:
        """Return (markdown, metadata) for the assembled document."""
        markdown = assemble_markdown(document.title, sections, with_toc=include_toc)
        meta = {
            "title": document.title,
            "doc_type": document.doc_type,
            "sections": len(_flatten(sections)),
            "words": word_count(markdown),
        }
        return markdown, meta


def _flatten(sections: list[DocumentSection]) -> list[DocumentSection]:
    out: list[DocumentSection] = []
    for s in sections:
        out.append(s)
        out.extend(_flatten(s.children))
    return out
