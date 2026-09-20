"""Parking spot: new paper → affected claim → re-appraise → status change → alert. Needs a scheduler and a saved appraisal to diff."""
from __future__ import annotations

from typing import Protocol


class LiteratureSurveillance(Protocol):
    def watch(self, appraisal_id: str) -> None: ...


SKIPPED = "literature_surveillance: not implemented in Phase 1 — a visible parking spot, not a result."
