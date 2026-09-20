from elute.models import Claim
from elute.pipeline.appraisal import derive_stance


def claims(links: bool = True, **statuses: str) -> list[Claim]:
    base = {"C_MECHANISM": "established", "C_DISEASE_RELEVANCE": "established", "C_EXPOSURE": "established", "C_ENGAGEMENT": "established",
            "C_DOWNSTREAM": "established", "C_CLINICAL": "established", "C_SAFETY": "unknown"}
    base.update(statuses)
    return [Claim(id=k, gate=k.lower(), statement=k, node=k, status=v, evidence_ids=(["EV_000000000000"] if links and v != "unknown" else [])) for k, v in base.items()]


def test_stance_rules_in_order():
    assert derive_stance(claims(links=False)) == "insufficient_evidence"
    assert derive_stance(claims(C_CLINICAL="refuted")) == "deprioritize"
    assert derive_stance(claims(C_ENGAGEMENT="unknown", C_CLINICAL="contested")) == "no_clear_prioritization"
    assert derive_stance(claims(C_CLINICAL="single-source")) == "pursue_conditionally"
    assert derive_stance(claims(C_EXPOSURE="contested")) == "no_clear_prioritization"
    # an unknown exposure does not block when the clinical claim is established
    assert derive_stance(claims(C_EXPOSURE="unknown")) == "no_clear_prioritization"  # falls to the last rule (a gate is unknown, not established/single-source)
