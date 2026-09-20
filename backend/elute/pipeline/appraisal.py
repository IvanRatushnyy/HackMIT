"""Deterministic appraisal (BACKEND_PLAN v4.4 §5 L8): claims → statuses → contradictions, unknowns, weakest link, next
question, stance. Pure functions over the VISIBLE evidence; nothing here reads dates or calls a model."""
from __future__ import annotations

from dataclasses import dataclass

from elute.engine.labels import StatusResult
from elute.engine.weakest_link import weakest
from elute.ids import GATE_ORDER
from elute.models import Claim, Evidence, MechanismEdge, NextQuestion, Resolved, Stance, WeakestLink
from elute.pipeline.claims import build_claims, mechanism_edges
from elute.pipeline.next_question import next_question

STANCE_PHRASE: dict[str, str] = {
    "deprioritize": "deprioritize",
    "no_clear_prioritization": "make no clear prioritization",
    "pursue_conditionally": "pursue conditionally",
    "insufficient_evidence": "call the evidence insufficient",
}


def derive_stance(claims: list[Claim]) -> Stance:
    by = {c.id: c for c in claims}
    with_links = [c for c in claims if c.evidence_ids]
    if len(with_links) < 2:
        return "insufficient_evidence"
    if by["C_CLINICAL"].status == "refuted":
        return "deprioritize"
    if (by["C_EXPOSURE"].status == "unknown" or by["C_ENGAGEMENT"].status == "unknown") and by["C_CLINICAL"].status != "established":
        return "no_clear_prioritization"
    gates = [by[g].status for g in GATE_ORDER]
    if all(s in ("established", "single-source") for s in gates):
        return "pursue_conditionally"
    return "no_clear_prioritization"


@dataclass
class Derived:
    claims: list[Claim]
    results: dict[str, StatusResult]
    edges: list[MechanismEdge]
    contradictions: list[Claim]
    unknowns: list[Claim]
    weakest_link: WeakestLink
    next_question: NextQuestion
    stance: Stance
    supporting_evidence_ids: list[str]
    counter_evidence_ids: list[str]


def derive(drug: str, disease: str, resolved: Resolved, visible_evidence: list[Evidence]) -> Derived:
    claims, results = build_claims(drug, disease, resolved, visible_evidence)
    contradictions = [c for c in claims if c.status in ("contested", "refuted")]
    unknowns = [c for c in claims if c.status == "unknown"]
    supporting = sorted({e.id for r in results.values() for e in r.supports})
    counter = sorted({e.id for r in results.values() for e in r.against})
    return Derived(claims=claims, results=results, edges=mechanism_edges(drug, disease, resolved), contradictions=contradictions,
                   unknowns=unknowns, weakest_link=weakest(claims, results), next_question=next_question(claims, drug, disease, resolved),
                   stance=derive_stance(claims), supporting_evidence_ids=supporting, counter_evidence_ids=counter)
