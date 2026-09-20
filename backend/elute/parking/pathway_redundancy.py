"""Parking spot: alternate routes around the target (branch points, other intervention points) over Reactome."""
from __future__ import annotations

from typing import Protocol


class PathwayRedundancy(Protocol):
    def alternate_paths(self, target_ensembl_id: str) -> list[list[str]]: ...


SKIPPED = "pathway_redundancy: not implemented in Phase 1 — a visible parking spot, not a result."
