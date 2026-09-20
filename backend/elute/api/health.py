"""GET /api/health (BACKEND_PLAN v4.4 §15). Never the key, never the model id."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from fastapi import APIRouter, Request

router = APIRouter()

Preferred = Literal["ok", "down", "unverified"]
Fallback = Literal["ok", "down", "unverified"]
TASKS = ("biology", "clinical_trials", "literature")


@dataclass
class HealthState:
    mode: str = "fixture"
    llm_configured: bool = False
    connectors: dict[str, dict[str, str]] = field(default_factory=lambda: {t: {"preferred": "unverified", "fallback": "unverified"} for t in TASKS})

    def as_dict(self) -> dict:
        return {"mode": self.mode, "llm_configured": self.llm_configured, "connectors": self.connectors}


@router.get("/health")
def health(request: Request) -> dict:
    state: HealthState = request.app.state.health
    return state.as_dict()
