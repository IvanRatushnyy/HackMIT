"""Parking spot: whether the candidate makes sense only in a molecular/genetic subgroup. Needs subgroup trial data and genetics."""
from __future__ import annotations

from typing import Protocol


class PatientStratification(Protocol):
    def subgroups(self, drug: str, disease: str) -> list[str]: ...


SKIPPED = "patient_stratification: not implemented in Phase 1 — a visible parking spot, not a result."
