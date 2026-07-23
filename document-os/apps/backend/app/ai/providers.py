"""LLM providers for the Gemma Engine.

- OllamaProvider:   local Gemma via Ollama (default, e.g. gemma3)
- OpenAIProvider:   any OpenAI-compatible chat-completions endpoint
- MockProvider:     deterministic offline provider so the full product is
                    demoable with zero external dependencies.
"""
import json
import re
import textwrap
from abc import ABC, abstractmethod

import httpx

from app.ai.schemas import LLMResponse
from app.core.config import get_settings


class BaseProvider(ABC):
    name: str = "base"
    model: str = "unknown"

    @abstractmethod
    async def generate(self, system: str, prompt: str, temperature: float = 0.4) -> LLMResponse: ...

    async def health(self) -> bool:
        return True


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.GEMMA_MODEL
        self.timeout = settings.AI_REQUEST_TIMEOUT

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def generate(self, system: str, prompt: str, temperature: float = 0.4) -> LLMResponse:
        payload = {
            "model": self.model,
            "system": system,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
        return LLMResponse(
            text=data.get("response", ""), provider=self.name, model=self.model, latency_ms=0
        )


class OpenAIProvider(BaseProvider):
    name = "openai"

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.OPENAI_BASE_URL.rstrip("/")
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.GEMMA_MODEL
        self.timeout = settings.AI_REQUEST_TIMEOUT

    async def generate(self, system: str, prompt: str, temperature: float = 0.4) -> LLMResponse:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", json=payload, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
        return LLMResponse(
            text=data["choices"][0]["message"]["content"],
            provider=self.name,
            model=self.model,
            latency_ms=0,
        )


# ---------------------------------------------------------------------------
# Mock provider: deterministic, offline, produces realistic structured output.
# ---------------------------------------------------------------------------

def _field(prompt: str, label: str, default: str = "") -> str:
    m = re.search(rf"^{re.escape(label)}:\s*(.+)$", prompt, flags=re.MULTILINE)
    return m.group(1).strip() if m else default


def _block(prompt: str, start: str, end: str) -> str:
    m = re.search(rf"{re.escape(start)}\n(.*?)\n{re.escape(end)}", prompt, flags=re.DOTALL)
    return m.group(1).strip() if m else ""


class MockProvider(BaseProvider):
    name = "mock"
    model = "gemma-mock"

    async def generate(self, system: str, prompt: str, temperature: float = 0.4) -> LLMResponse:
        if "[agent:planner]" in system:
            text = self._plan(prompt)
        elif "[agent:writer]" in system:
            text = self._write(prompt)
        elif "[agent:refiner]" in system:
            text = self._refine(prompt)
        elif "[agent:validator]" in system:
            text = json.dumps({"passed": True, "issues": []})
        elif "[agent:reviewer]" in system:
            text = self._review(prompt)
        else:
            text = "OK"
        return LLMResponse(text=text, provider=self.name, model=self.model, latency_ms=0)

    # -- per-agent deterministic generators --

    def _plan(self, prompt: str) -> str:
        request = _field(prompt, "USER REQUEST", "Untitled Document")
        doc_type = _field(prompt, "DOCUMENT TYPE", "general")
        title = _field(prompt, "TITLE HINT") or self._titleize(request)
        template_raw = _block(prompt, "TEMPLATE OUTLINE (JSON):", "END TEMPLATE")
        if template_raw:
            try:
                outline = json.loads(template_raw)
                sections = [self._node_from_template(n, doc_type) for n in outline]
                return json.dumps({"title": title, "sections": sections})
            except (json.JSONDecodeError, AttributeError):
                pass
        core_children = [
            {"title": "Key Capabilities", "prompt": f"Describe the key capabilities of {title}.", "children": []},
            {"title": "User Workflows", "prompt": f"Describe the primary user workflows in {title}.", "children": []},
            {"title": "Edge Cases", "prompt": f"Describe edge cases and how {title} handles them.", "children": []},
        ]
        sections = [
            {"title": "Introduction", "prompt": f"Introduce {title}: what it is and why it matters.", "children": []},
            {"title": "Objectives", "prompt": f"List the measurable objectives of {title}.", "children": []},
            {"title": "Scope", "prompt": f"Define what is in scope and out of scope for {title}.", "children": []},
            {"title": "Core Requirements", "prompt": f"Detail the core requirements of {title}.", "children": core_children},
            {"title": "Risks and Mitigations", "prompt": f"Identify the main risks for {title} and mitigations.", "children": []},
            {"title": "Success Metrics", "prompt": f"Define measurable success metrics for {title}.", "children": []},
            {"title": "Conclusion", "prompt": f"Summarize {title} and state next steps.", "children": []},
        ]
        return json.dumps({"title": title, "sections": sections})

    @staticmethod
    def _node_from_template(node: dict, doc_type: str) -> dict:
        return {
            "title": node.get("title", "Section"),
            "prompt": node.get("prompt") or f"Write the '{node.get('title', 'Section')}' section of this {doc_type} document.",
            "children": [MockProvider._node_from_template(c, doc_type) for c in node.get("children", [])],
        }

    @staticmethod
    def _titleize(request: str) -> str:
        words = request.strip().split()
        short = " ".join(words[:8])
        return short[:1].upper() + short[1:]

    def _write(self, prompt: str) -> str:
        doc = _field(prompt, "DOCUMENT TITLE", "this document")
        section = _field(prompt, "SECTION TITLE", "Overview")
        goal = _field(prompt, "SECTION GOAL", f"Cover {section.lower()} for {doc}.")
        slug = section.lower()
        return textwrap.dedent(f"""\
            This section addresses **{section}** for *{doc}*. {goal} The goal is to give
            stakeholders a shared, unambiguous reference that can be reviewed, versioned and
            refined independently of the rest of the document.

            Key points covered here:

            - **Context** — why {slug} matters to the overall success of {doc}.
            - **Approach** — the concrete decisions and mechanisms that implement this section.
            - **Ownership** — who is responsible for keeping this section accurate over time.

            | Aspect | Description | Status |
            | ------ | ----------- | ------ |
            | Definition | What "{section}" means in the context of {doc} | Drafted |
            | Dependencies | Sections this one relies on | Identified |
            | Review | Validation and review status | Pending |

            Because every section in this document is independently versioned, this content can be
            regenerated or refined in isolation: changing it never forces a rewrite of unrelated
            sections. Update the section prompt above and regenerate to iterate on this content.""")

    def _refine(self, prompt: str) -> str:
        action = _field(prompt, "ACTION", "improve")
        language = _field(prompt, "TARGET LANGUAGE", "English")
        text = _block(prompt, "TEXT START", "TEXT END") or prompt
        first = text.split("\n\n")[0].strip()
        sentences = re.split(r"(?<=[.!?])\s+", first)
        if action == "shorten":
            return sentences[0] if sentences else first
        if action == "expand":
            return (
                f"{text}\n\nIn more detail: this point has direct consequences for how the document "
                f"is reviewed and maintained. Expanding on it clarifies intent for every stakeholder, "
                f"reduces ambiguity during implementation, and provides concrete criteria that the "
                f"Validator agent can check in later passes. Each claim here can be traced back to the "
                f"section prompt, keeping the change fully auditable."
            )
        if action == "summarize":
            return f"- {sentences[0] if sentences else first}\n- Supporting detail available in the full section.\n- Actionable and independently versioned."
        if action == "continue":
            return (
                f"{text}\n\nBuilding on this, the next consideration is how the section evolves over "
                f"time. Because DocumentOS tracks every revision, contributors can iterate confidently: "
                f"each refinement is recorded, comparable, and reversible. The recommended practice is "
                f"to keep paragraphs short, prefer lists for enumerations, and let the Reviewer agent "
                f"flag drift before export."
            )
        if action == "translate":
            return f"[{language}] {text}"
        if action == "professional":
            return f"**Revised (professional tone).** {first}\n\nAll statements herein are provided for formal review and approval by the relevant stakeholders."
        if action == "friendly":
            return f"{first} — and honestly, that's great news for the team: it keeps things simple, transparent, and easy to improve as we go."
        if action == "academic":
            return f"{first} Furthermore, the foregoing analysis is situated within a structured documentation framework, wherein each section constitutes an independently versioned unit of scholarly record."
        if action == "legal":
            return f"{first} Notwithstanding the foregoing, the provisions set forth in this section shall be construed in accordance with, and governed by, the terms of the present document in its entirety."
        if action == "fix_grammar":
            fixed = re.sub(r"\s+", " ", text).strip()
            return fixed[:1].upper() + fixed[1:]
        if action == "examples":
            return f"{text}\n\n**Examples:**\n\n1. A product team regenerates only the '{ 'Requirements' }' section after stakeholder feedback — the rest of the document is untouched.\n2. A legal reviewer applies the *Legal tone* refinement to a single clause and restores the previous version instantly when needed.\n3. An engineer exports the same document to PDF and DOCX from one Markdown source of truth."
        # rewrite / improve
        return f"{first}\n\nPut differently: the intent is unchanged, but the phrasing is tighter, easier to scan, and ready for professional review."

    def _review(self, prompt: str) -> str:
        markdown = _block(prompt, "DOCUMENT MARKDOWN:", "END DOCUMENT")
        words = len(markdown.split())
        headings = len(re.findall(r"^#{1,6}\s", markdown, flags=re.MULTILINE))
        completeness = min(95, 40 + headings * 5)
        readability = 82 if words > 200 else 70
        score = int((completeness + readability) / 2)
        return json.dumps({
            "score": score,
            "readability": readability,
            "completeness": completeness,
            "confidence": 0.82,
            "summary": (
                f"The document is well structured with {headings} sections and roughly {words} words. "
                "Coverage aligns with the planned outline and the tone is consistent. "
                "It is ready for stakeholder review after minor polish."
            ),
            "suggestions": [
                "Add concrete acceptance criteria to requirement-style sections.",
                "Prefer tables for comparisons and lists for enumerations.",
                "Run the Validator before every export to catch structural drift.",
                "Regenerate sections individually instead of rewriting the whole document.",
            ],
        })
