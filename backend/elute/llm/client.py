"""LLMClient (BACKEND_PLAN v4.4 §4): one method, `complete_structured`. OpenAIClient is the only real implementation;
NullClient stands in when no key is set (every caller degrades per §14); RecordingClient/ReplayClient make tests
deterministic and let the sentinel test read every prompt the model would have seen."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMClient(Protocol):
    name: str

    def complete_structured(self, schema: type[T], system: str, user: str) -> T | None: ...


class NullClient:
    name = "null"

    def complete_structured(self, schema: type[T], system: str, user: str) -> T | None:
        return None


def prompt_key(schema_name: str, system: str, user: str) -> str:
    return hashlib.sha256(json.dumps({"schema": schema_name, "system": system, "user": user}, sort_keys=True).encode()).hexdigest()[:20]


class ReplayClient:
    """Replays recorded model outputs by prompt hash from a directory of JSON files; a miss returns None (degrade)."""

    name = "replay"

    def __init__(self, root: Path, *, record_with: "LLMClient | None" = None):
        self.root = Path(root)
        self.inner = record_with
        self.prompts: list[dict[str, str]] = []  # every prompt seen, for the sentinel test
        self.misses: list[str] = []  # prompts no cassette answered (schema/key): the run degrades exactly as with no model

    def complete_structured(self, schema: type[T], system: str, user: str) -> T | None:
        self.prompts.append({"schema": schema.__name__, "system": system, "user": user})
        p = self.root / schema.__name__ / f"{prompt_key(schema.__name__, system, user)}.json"
        if p.exists():
            return schema.model_validate(json.loads(p.read_text())["output"])
        self.misses.append(f"{schema.__name__}/{p.stem}")
        if self.inner is None:
            return None
        out = self.inner.complete_structured(schema, system, user)
        if out is not None:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps({"schema": schema.__name__, "system": system, "user": user, "output": out.model_dump(mode="json")}, indent=1, ensure_ascii=False))
        return out


class RecordingClient:
    """Wraps any client and captures every prompt (tests: the sentinel must never appear in these)."""

    name = "recording"

    def __init__(self, inner: LLMClient):
        self.inner = inner
        self.prompts: list[dict[str, str]] = []

    def complete_structured(self, schema: type[T], system: str, user: str) -> T | None:
        self.prompts.append({"schema": schema.__name__, "system": system, "user": user})
        return self.inner.complete_structured(schema, system, user)
