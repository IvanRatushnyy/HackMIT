"""Parking spot: off-label / routine-care signal. Needs governed patient data, causal inference and regulatory review; never promotion."""
from __future__ import annotations

from typing import Protocol


class RealWorldEvidence(Protocol):
    def signal(self, drug: str, disease: str) -> None: ...


SKIPPED = "real_world_evidence: not implemented in Phase 1 — requires governed data and causal inference."
