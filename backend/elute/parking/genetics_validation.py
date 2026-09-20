"""Parking spot: causal human genetic support for the target (Mendelian, coding, fine-mapped, MR). Needs MR pipelines
and, in deployment, proprietary genetics. Any Open Targets datatype shown in Phase 1 is labelled a proxy."""
from __future__ import annotations

from typing import Protocol


class GeneticsValidation(Protocol):
    def tier(self, target_ensembl_id: str, disease_efo_id: str) -> str: ...  # mendelian | coding | fine-mapped | locus | none


SKIPPED = "genetics_validation: not implemented in Phase 1 — a visible parking spot, not a result."
