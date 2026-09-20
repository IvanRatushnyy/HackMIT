"""Temporal visibility (BACKEND_PLAN v4.4 §9).

`visible()` is the single visibility boundary. It is called INSIDE the retrieval steps (L2/L3/L4) on dated,
deduplicated metadata records before any content is fetched or any model call is made. `audit()` runs at L6 over the
normalized Evidence: it never filters, it verifies `publication_date <= as_of` for every Evidence, returns the
user-facing visibility summary, and raises on any leak.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Sequence, TypeVar

from elute.models import Evidence, RetrievalCounts

T = TypeVar("T")


def _date_of(item: Any) -> str | None:
    for attr in ("publication_date", "published"):
        v = getattr(item, attr, None)
        if v is None and isinstance(item, dict):
            v = item.get(attr)
        if v:
            return str(v)
    return None


def visible(records: Sequence[T], as_of: str) -> list[T]:
    """Records whose authoritative date is on or before `as_of`. Undated records are never visible."""
    return [r for r in records if (d := _date_of(r)) is not None and d <= as_of]


def withheld(records: Sequence[T], as_of: str) -> list[T]:
    return [r for r in records if (d := _date_of(r)) is None or d > as_of]


class TemporalLeak(Exception):
    """A post-cutoff Evidence reached the appraisal. The run fails validation; nothing is returned."""


@dataclass
class VisibilitySummary:
    as_of: str
    evidence_visible: int
    per_step: dict[str, RetrievalCounts]
    records_withheld_total: int


def audit(evidence: Iterable[Evidence], as_of: str, per_step: dict[str, RetrievalCounts] | None = None) -> VisibilitySummary:
    """Verify every Evidence is visible on `as_of`; summarise; raise TemporalLeak otherwise. Never filters."""
    ev = list(evidence)
    leaked = [e for e in ev if e.publication_date > as_of]
    if leaked:
        raise TemporalLeak(f"{len(leaked)} evidence record(s) dated after {as_of} reached the appraisal: "
                           + ", ".join(f"{e.id} ({e.publication_date})" for e in leaked[:5]))
    per_step = per_step or {}
    total_withheld = sum(c.records_withheld for c in per_step.values())
    return VisibilitySummary(as_of=as_of, evidence_visible=len(ev), per_step=per_step, records_withheld_total=total_withheld)
