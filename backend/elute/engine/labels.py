"""Claim status — a port of the six ordered rules in `src/lib/evidence.ts` (BACKEND_PLAN v4.4 §5), evaluated over the
visible relevance links of one claim. Statuses are per claim; the clinical claim can be `refuted` while the mechanism
stays `established`."""
from __future__ import annotations

from dataclasses import dataclass, field

from elute.engine.independence import distinct_groups, key_authors
from elute.models import Evidence, Status

REFUTES_GATE_MSG = "a `refutes` link requires a controlled, blinded, negative source"


def passes_refutes_gate(e: Evidence) -> bool:
    return bool(e.controlled) and e.blinded is True and e.outcome == "negative"


@dataclass
class StatusResult:
    status: Status
    why: str
    supports: list[Evidence] = field(default_factory=list)
    against: list[Evidence] = field(default_factory=list)  # contradicts + refutes
    caveats: list[str] = field(default_factory=list)


def _design_word(e: Evidence) -> str:
    return {"rct": "blinded randomised trial" if e.blinded else "randomised trial", "open-label": "open-label study",
            "pk": "pharmacokinetic measurement", "commentary": "peer commentary", "preclinical": "preclinical study",
            "observational": "observational study", "protocol": "registered protocol", "label": "approved product label",
            "regulatory": "regulatory decision", "meta-analysis": "meta-analysis", "unknown": "study of unstated design"}[e.study_type]


def _cite(e: Evidence) -> str:
    return f"{e.first_author}, {e.year}"


def derive_status(claim_id: str, evidence: list[Evidence]) -> StatusResult:
    """`evidence` must already be the VISIBLE set for the requested date; this function never reads dates."""
    supports: list[Evidence] = []
    contradicts: list[Evidence] = []
    refutes: list[Evidence] = []
    for e in evidence:
        for r in e.relevance:
            if r.claim_id != claim_id:
                continue
            if r.direction in ("supports", "qualifies"):
                supports.append(e)
            elif r.direction == "refutes" and passes_refutes_gate(e):
                refutes.append(e)
            else:  # contradicts, or a refutes that fails the gate
                contradicts.append(e)
    # de-duplicate an evidence appearing twice for the same claim
    supports = list({e.id: e for e in supports}.values())
    contradicts = list({e.id: e for e in contradicts}.values())
    refutes = list({e.id: e for e in refutes}.values())
    against = refutes + [e for e in contradicts if e.id not in {r.id for r in refutes}]
    caveats = sorted({c for e in supports for c in e.caveats})

    if not supports and not against:
        return StatusResult("unknown", "Nothing visible on or before this date tests or supports this claim.", caveats=caveats)
    if refutes:
        r = refutes[0]
        n = f" of {r.sample_size}" if r.sample_size else ""
        return StatusResult("refuted", f"Tested directly in a {_design_word(r)}{n} ({_cite(r)}) and found false.", supports, against, caveats)
    if contradicts:
        if supports:
            why = (f"Evidence on both sides: {len(supports)} source{'s' if len(supports) > 1 else ''} support{'' if len(supports) > 1 else 's'} it "
                   f"and {len(contradicts)} argue{'' if len(contradicts) > 1 else 's'} against it.")
        else:
            why = f"No published evidence supports this claim; {len(contradicts)} source{'s' if len(contradicts) > 1 else ''} argue{'' if len(contradicts) > 1 else 's'} against it."
        return StatusResult("contested", why, supports, against, caveats)
    regulatory = next((e for e in supports if e.study_type in ("label", "regulatory")), None)
    groups = distinct_groups([(e.independence_group, key_authors(e.authors)) for e in supports])
    if regulatory or groups >= 2:
        if regulatory:
            why = f"Accepted by a regulator ({_cite(regulatory)})" + (f" and reported by {groups} independent groups" if groups > 1 else "") + "."
        else:
            why = f"Reported by {groups} independent groups ({'; '.join(_cite(e) for e in supports)}), none contradicting" + (f", {', '.join(caveats)}" if caveats else "") + "."
        return StatusResult("established", why, supports, against, caveats)
    s = supports[0]
    n = f" of {s.sample_size}" if s.sample_size else ""
    unknown_note = " (independence of the supporting groups could not be established)" if len(supports) > 1 else ""
    return StatusResult("single-source", f"One group reports this ({_cite(s)}, {_design_word(s)}{n}); nothing visible on or before this date replicates or contradicts it{unknown_note}.",
                        supports, against, caveats)
