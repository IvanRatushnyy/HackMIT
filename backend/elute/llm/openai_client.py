"""The only real LLM implementation: OpenAI Responses API with structured outputs (BACKEND_PLAN v4.4 §4).
Model from OPENAI_MODEL; the key from OPENAI_API_KEY; neither is logged, echoed or returned."""
from __future__ import annotations

import logging
from typing import TypeVar

from pydantic import BaseModel

from elute.settings import Settings

log = logging.getLogger("elute.llm")
T = TypeVar("T", bound=BaseModel)


class OpenAIClient:
    name = "openai"

    def __init__(self, settings: Settings, *, timeout_s: float = 60.0):
        if not settings.llm_credentials_present:
            raise ValueError("OPENAI_API_KEY and OPENAI_MODEL must both be set")
        from openai import OpenAI

        self.model = settings.OPENAI_MODEL
        self._client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout_s)

    def probe(self) -> bool:
        try:
            self._client.responses.create(model=self.model, input="Reply with the single word: ok", max_output_tokens=16)
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("OpenAI probe failed: %s", type(e).__name__)
            return False

    def complete_structured(self, schema: type[T], system: str, user: str) -> T | None:
        try:
            resp = self._client.responses.parse(model=self.model, input=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                                                text_format=schema)
            return resp.output_parsed
        except Exception as e:  # noqa: BLE001 — the caller degrades; the failure is on the trace, never fatal
            log.warning("OpenAI %s call failed: %s", schema.__name__, type(e).__name__)
            return None
