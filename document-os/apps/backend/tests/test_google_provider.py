"""Google AI provider: message conversion, complete/stream, detection — with a fake client."""
import os

os.environ.setdefault("AI_PROVIDER", "mock")

import pytest

from app.ai.providers import aget_provider, reset_provider
from app.ai.providers.google_ai import GoogleAIProvider
from app.ai.schemas import LLMMessage
from app.core.config import get_settings
from app.core.errors import AIProviderError


class _FakePart:
    def __init__(self, text):
        self.text = text


class _FakeContent:
    def __init__(self, role, parts):
        self.role = role
        self.parts = parts


class _FakeTypes:
    Content = _FakeContent

    class Part:
        @staticmethod
        def from_text(text):
            return _FakePart(text)

    class GenerateContentConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs


class _FakeModels:
    def __init__(self, chunks):
        self._chunks = chunks
        self.last_call = None

    async def generate_content(self, model, contents, config):
        self.last_call = {"model": model, "contents": contents, "config": config}

        class R:
            text = "full response"

        return R()

    async def generate_content_stream(self, model, contents, config):
        self.last_call = {"model": model, "contents": contents, "config": config}

        class S:
            def __init__(self, chunks):
                self._chunks = chunks

            def __aiter__(self):
                return self._gen()

            async def _gen(self):
                for c in self._chunks:
                    yield c

        class C:
            def __init__(self, text):
                self.text = text

        return S([C(t) for t in self._chunks])


class _FakeAio:
    def __init__(self, chunks):
        self.models = _FakeModels(chunks)


class _FakeClient:
    def __init__(self, api_key, chunks=("a", "b")):
        self.api_key = api_key
        self.aio = _FakeAio(list(chunks))


def _make_provider(monkeypatch, chunks=("Hello ", "world")):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    get_settings.cache_clear()
    import app.ai.providers.google_ai as mod
    import google.genai as genai_mod

    fake_genai = type("genai", (), {"Client": lambda api_key: _FakeClient(api_key, chunks), "types": _FakeTypes})
    monkeypatch.setattr(genai_mod, "Client", fake_genai.Client)
    provider = GoogleAIProvider()
    provider._genai = fake_genai
    provider._client = _FakeClient("test-key", chunks)
    return provider


def test_requires_api_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    with pytest.raises(AIProviderError):
        GoogleAIProvider()
    get_settings.cache_clear()


def test_message_conversion(monkeypatch):
    provider = _make_provider(monkeypatch)
    system, contents = provider._convert(
        [
            LLMMessage(role="system", content="be terse"),
            LLMMessage(role="user", content="hi"),
            LLMMessage(role="assistant", content="hello"),
            LLMMessage(role="user", content="again"),
        ]
    )
    assert system == "be terse"
    assert [c.role for c in contents] == ["user", "model", "user"]
    get_settings.cache_clear()


async def test_complete_and_stream(monkeypatch):
    provider = _make_provider(monkeypatch)
    resp = await provider.complete(
        [LLMMessage(role="system", content="s"), LLMMessage(role="user", content="u")],
        temperature=0.2,
        max_tokens=64,
    )
    assert resp.text == "full response"
    assert resp.model == get_settings().GOOGLE_MODEL
    call = provider._client.aio.models.last_call
    assert call["config"].kwargs["temperature"] == 0.2
    assert call["config"].kwargs["max_output_tokens"] == 64
    assert call["config"].kwargs["system_instruction"] == "s"

    chunks = [c async for c in provider.stream([LLMMessage(role="user", content="u")], temperature=0.2, max_tokens=64)]
    assert chunks == ["Hello ", "world"]
    get_settings.cache_clear()


async def test_auto_detection_prefers_google_when_key_set(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "auto")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    get_settings.cache_clear()
    reset_provider()
    import google.genai as genai_mod

    monkeypatch.setattr(genai_mod, "Client", lambda api_key: _FakeClient(api_key))
    try:
        provider = await aget_provider()
        assert provider.name == "google"
    finally:
        reset_provider()
        get_settings.cache_clear()
