"""Shared vocabulary for every connector (BACKEND_PLAN v4.1 §6, §8, §9a).

A connector answers one call — a tool name and its arguments — with a payload in the ToolUniverse
response shape for that tool. Mappers in `records.py` turn a payload into RawRecords. Nothing after
`normalize.py` ever sees a payload or knows which transport delivered a record.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Transport = Literal["tooluniverse", "direct", "fixture"]
Outcome = Literal["ok", "error", "timeout", "empty", "insufficient"]
TaskKind = Literal["resolve", "biology", "trials", "literature"]
RecordKind = Literal["entity", "mechanism", "association", "trial-registration", "trial-results", "article"]


@dataclass
class Task:
    """One scientific question for one ledger step. Resolved ids travel with it so queries use canonical names."""

    id: str  # ledger step: "L2"
    kind: TaskKind
    question: str  # ≤ 6 words on the trace
    drug: str
    disease: str
    drug_chembl_id: str | None = None
    disease_efo_id: str | None = None
    disease_aliases: list[str] = field(default_factory=list)  # canonical name first; used by the sufficiency check
    target_symbol: str | None = None
    target_aliases: list[str] = field(default_factory=list)  # "c-Abl", "Abl"
    target_ensembl_id: str | None = None
    facet: str | None = None  # literature only; see pipeline.tools.LITERATURE_FACETS


@dataclass
class RawRecord:
    """One retrieved record, dated where the source allows. `payload` is the source's own fields, verbatim."""

    id: str
    task_id: str
    kind: RecordKind
    transport: Transport
    tool: str
    source_name: str
    url: str
    published: str | None  # ISO date; None means undated → never becomes Evidence
    date_basis: str  # how `published` was derived, printed on Provenance; "undated" when None
    text: str  # what the sufficiency check reads: title + abstract, or the record's statement
    payload: dict[str, Any]
    pmid: str | None = None
    nct_id: str | None = None


@dataclass
class Attempt:
    """One call inside a step. Every attempt is recorded, including the ones that did not count."""

    n: int
    transport: Transport
    tool: str
    query: dict[str, Any]
    outcome: Outcome
    records_returned: int
    elapsed_ms: int
    reason: str | None = None


class ToolError(Exception):
    """A call failed (transport error, tool-level error, validation error). `retriable` follows the tool's own flag."""

    def __init__(self, message: str, *, retriable: bool = False, kind: str = "error"):
        super().__init__(message)
        self.retriable = retriable
        self.kind = kind


class CacheMiss(Exception):
    """Raised in offline mode when a payload is not in the cache. Tests and fixture mode never reach the network."""
