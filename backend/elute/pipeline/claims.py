"""The seven fixed claims and six fixed edges (BACKEND_PLAN v4.4 §7, §13 L7). Statements are templated from the
resolved names; links come only from Evidence.relevance. Missing evidence → `unknown`; nothing is filled from memory."""
from __future__ import annotations

from elute.engine.labels import StatusResult, derive_status
from elute.ids import CLAIM_IDS
from elute.models import Claim, Evidence, MechanismEdge, Resolved

CNS_MARKERS = ("parkinson", "alzheimer", "huntington", "sclerosis", "epilep", "schizophren", "depress", "dementia", "ataxia", "neuro")


def compartment_for(disease: str) -> str:
    d = disease.lower()
    return "the central nervous system" if any(m in d for m in CNS_MARKERS) else "the target tissue"


def claim_definitions(drug: str, disease: str, resolved: Resolved) -> list[Claim]:
    target = resolved.target_symbol or "its target"
    comp = compartment_for(disease)
    defs = [
        ("C_MECHANISM", "mechanism", f"{drug} inhibits {target} at clinical doses.", target),
        ("C_DISEASE_RELEVANCE", "disease_relevance", f"{target} activity is altered in {disease} and relevant to its pathology.", f"{target} in {disease}"),
        ("C_EXPOSURE", "exposure", f"{drug} reaches {comp} at a tolerated dose in a concentration that can inhibit {target}.", f"exposure in {comp}"),
        ("C_ENGAGEMENT", "engagement", f"{drug} engages {target} in patients.", "target engagement"),
        ("C_DOWNSTREAM", "downstream", f"Engaging {target} produces the expected downstream biology in {disease}.", "downstream biology"),
        ("C_CLINICAL", "clinical", f"{drug} improves clinical outcomes in {disease}.", "clinical benefit"),
        ("C_SAFETY", "safety", f"The safety of {drug} is acceptable in the likely {disease} trial population.", "safety"),
    ]
    assert [d[0] for d in defs] == list(CLAIM_IDS)
    return [Claim(id=i, gate=g, statement=s, node=n) for i, g, s, n in defs]


def mechanism_edges(drug: str, disease: str, resolved: Resolved) -> list[MechanismEdge]:
    target = resolved.target_symbol or "target"
    comp = compartment_for(disease)
    return [
        MechanismEdge(source=drug, relation="inhibits", target=target, claim_id="C_MECHANISM"),
        MechanismEdge(source=target, relation="is altered in", target=f"{disease} biology", claim_id="C_DISEASE_RELEVANCE"),
        MechanismEdge(source=f"{drug} in blood", relation="crosses into", target=comp, claim_id="C_EXPOSURE"),
        MechanismEdge(source=f"{drug} in {comp}", relation="engages", target=target, claim_id="C_ENGAGEMENT"),
        MechanismEdge(source=f"{target} engaged", relation="produces", target="downstream biology", claim_id="C_DOWNSTREAM"),
        MechanismEdge(source="downstream biology", relation="improves", target="clinical outcome", claim_id="C_CLINICAL"),
    ]


def build_claims(drug: str, disease: str, resolved: Resolved, visible_evidence: list[Evidence]) -> tuple[list[Claim], dict[str, StatusResult]]:
    """Attach links, derive statuses. `visible_evidence` must already be the visible set for the date."""
    claims = claim_definitions(drug, disease, resolved)
    results: dict[str, StatusResult] = {}
    for c in claims:
        r = derive_status(c.id, visible_evidence)
        results[c.id] = r
        c.evidence_ids = [e.id for e in visible_evidence if any(x.claim_id == c.id for x in e.relevance)]
        c.status, c.status_why, c.caveats = r.status, r.why, r.caveats
    return claims, results
