"""Validation (BACKEND_PLAN v4.4 §5, §6): structural checks on the appraisal, and the synthesis gate that rejects
uncited sentences, unmatched numbers, ignored contradictions and stance mismatches. Used on OpenAI output and on the
curated fixture synthesis alike."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from elute.ids import CLAIM_IDS
from elute.models import CaseItem, Claim, Evidence, MechanismEdge, Synthesis
from elute.pipeline.appraisal import STANCE_PHRASE


class ValidationError(Exception):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


# ---- structural ---------------------------------------------------------------------------------

def validate_structure(evidence: list[Evidence], claims: list[Claim], edges: list[MechanismEdge]) -> list[str]:
    problems: list[str] = []
    ids = {e.id for e in evidence}
    if len(ids) != len(evidence):
        problems.append("duplicate evidence ids")
    for e in evidence:
        if not (e.publication_date and e.source_url and e.source_provider and e.transport):
            problems.append(f"evidence {e.id} missing date/url/provider/transport")
        for r in e.relevance:
            if r.claim_id not in CLAIM_IDS:
                problems.append(f"evidence {e.id} names unknown claim {r.claim_id}")
    claim_ids = {c.id for c in claims}
    if claim_ids != set(CLAIM_IDS):
        problems.append(f"expected the seven fixed claims, found {sorted(claim_ids)}")
    for c in claims:
        if not c.evidence_ids and c.status != "unknown":
            problems.append(f"claim {c.id} has no evidence but status {c.status}")
        for i in c.evidence_ids:
            if i not in ids:
                problems.append(f"claim {c.id} references unknown evidence {i}")
    for edge in edges:
        if edge.claim_id not in claim_ids:
            problems.append(f"edge {edge.source}→{edge.target} names unknown claim {edge.claim_id}")
    return problems


# ---- numbers ------------------------------------------------------------------------------------

_ISO_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
_IDS = re.compile(r"\b(?:NCT\d{8}|PMC\d+|PMID:?\s*\d+|CHEMBL\d+|ENSG\d+|MONDO[_:]\d+|EFO[_:]\d+)\b", re.I)
_RANGE = re.compile(r"(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(%|percent|per cent)", re.I)
_NUM = re.compile(r"(?<![A-Za-z0-9_./-])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![A-Za-z])\s*(%|percent|per cent)?", re.I)
_PROB = re.compile(r"(\d+(?:\.\d+)?\s*%?\s*(?:chance|probability|likelihood|confidence|odds)|(?:chance|probability|likelihood|confidence|odds)\s*(?:of|is|=|:)?\s*\d+(?:\.\d+)?\s*%?)", re.I)


@dataclass(frozen=True)
class Number:
    value: Decimal
    unit: str | None  # "percent" | None
    text: str


def extract_numbers(text: str) -> list[Number]:
    """Numeric tokens with formatting normalized: 0.53%, 0.53 %, 0.530 percent are all (0.53, percent). Dates,
    registry ids and years (1900–2099 with no unit) are not numbers."""
    t = _IDS.sub(" ", _ISO_DATE.sub(" ", text))
    t = _RANGE.sub(lambda m: f"{m[1]} {m[3]} {m[2]} {m[3]}", t)  # 0.23–1.5 % → both carry the unit
    out: list[Number] = []
    for m in _NUM.finditer(t):
        raw = m[1].replace(",", "") + (f".{m[2]}" if m[2] else "")
        try:
            v = Decimal(raw)
        except InvalidOperation:
            continue
        unit = "percent" if m[3] else None
        if unit is None and not m[2] and 1900 <= v <= 2099:
            continue  # a bare year
        out.append(Number(v, unit, m[0].strip()))
    return out


def evidence_numbers(e: Evidence) -> list[Number]:
    texts = [e.statement] + [r.statement for r in e.relevance] + [r.verbatim_sentence or "" for r in e.relevance] + [p.verbatim_sentence for p in e.pk_facts]
    nums = [n for t in texts for n in extract_numbers(t)]
    if e.sample_size is not None:
        nums.append(Number(Decimal(e.sample_size), None, f"n = {e.sample_size}"))
    for p in e.pk_facts:
        try:
            nums.append(Number(Decimal(p.value), "percent" if (p.unit or "").startswith("perc") else p.unit, p.value))
        except InvalidOperation:
            pass
    return nums


def _matches(a: Number, b: Number) -> bool:
    if (a.unit or None) != (b.unit or None):
        return False
    if a.value == b.value:
        return True
    tol = Decimal("0.005") * max(abs(a.value), abs(b.value))
    if abs(a.value - b.value) <= tol:
        return True
    exp = b.value.as_tuple().exponent
    if isinstance(exp, int) and exp < 0:
        return a.value.quantize(b.value) == b.value
    return False


def check_numbers(sentence: str, cited: list[Evidence]) -> list[str]:
    """Every number in `sentence` must match a number in the cited evidence; probabilities/confidences are rejected
    unless the cited evidence contains them verbatim."""
    problems: list[str] = []
    pool = [n for e in cited for n in evidence_numbers(e)]
    for n in extract_numbers(sentence):
        if not any(_matches(n, p) for p in pool):
            problems.append(f"number '{n.text}' is not in the cited evidence")
    for m in _PROB.finditer(sentence):
        if not any(m[0].lower() in (e.statement + " ".join(r.statement for r in e.relevance)).lower() for e in cited):
            problems.append(f"probability/confidence language not in the cited evidence: '{m[0]}'")
    return problems


# ---- the synthesis gate ---------------------------------------------------------------------------

@dataclass
class GateResult:
    ok: bool
    problems: list[str] = field(default_factory=list)


def gate(synth: Synthesis, evidence: list[Evidence], claims: list[Claim], stance: str,
         against_by_claim: dict[str, list[str]]) -> GateResult:
    """`against_by_claim`: claim id → evidence ids that contradict/refute it (visible). Rules of §6.5–6.6."""
    problems: list[str] = []
    by_id = {e.id: e for e in evidence}
    claim_ids = {c.id for c in claims}
    all_cited: set[str] = set()

    def check_items(items: list[CaseItem], where: str) -> None:
        for i, item in enumerate(items):
            ev_cites = [c for c in item.cites if c in by_id]
            bad = [c for c in item.cites if c not in by_id and c not in claim_ids]
            if bad:
                problems.append(f"{where}[{i}] cites unknown id(s) {bad}")
            if not item.cites or not (ev_cites or [c for c in item.cites if c in claim_ids]):
                problems.append(f"{where}[{i}] has no resolving citation")
            all_cited.update(item.cites)
            # numbers must come from the cited evidence; a claim-only citation may only carry numbers found in that claim's evidence
            pool = [by_id[c] for c in ev_cites]
            for c in item.cites:
                if c in claim_ids:
                    pool += [by_id[i2] for i2 in next(cl.evidence_ids for cl in claims if cl.id == c) if i2 in by_id]
            for p in check_numbers(item.text, pool):
                problems.append(f"{where}[{i}]: {p}")

    check_items(synth.strongest_case_for, "strongest_case_for")
    check_items(synth.strongest_case_against, "strongest_case_against")

    # every contested/refuted claim must have one of its against-links cited in the case against
    against_cites = {c for item in synth.strongest_case_against for c in item.cites}
    for c in claims:
        if c.status in ("contested", "refuted"):
            ids = against_by_claim.get(c.id, [])
            if ids and not (set(ids) & against_cites):  # citing the claim id alone is not citing its contradicting evidence
                problems.append(f"{c.id} is {c.status} but none of its contradicting evidence is cited in the case against")

    # the opinion: stance phrase present; numbers from anything cited in either case
    phrase = STANCE_PHRASE[stance]
    if phrase not in synth.opinion:
        problems.append(f"opinion does not carry the stance phrase '{phrase}'")
    pool = [by_id[c] for c in all_cited if c in by_id]
    for c in all_cited:
        if c in claim_ids:
            pool += [by_id[i2] for i2 in next(cl.evidence_ids for cl in claims if cl.id == c) if i2 in by_id]
    for p in check_numbers(synth.opinion, pool) + check_numbers(synth.what_would_change_my_mind, pool):
        problems.append(f"opinion: {p}")
    return GateResult(ok=not problems, problems=problems)
