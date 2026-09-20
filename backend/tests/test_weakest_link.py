"""The six required assertions of BACKEND_PLAN §5 on two-claim fixtures, plus the tie-breaks."""
from __future__ import annotations

from elute.engine.labels import StatusResult
from elute.engine.weakest_link import WEAKNESS, weakest
from elute.models import Claim


def claim(cid: str, status: str, caveats: list[str] | None = None) -> Claim:
    return Claim(id=cid, gate=cid.lower(), statement=cid, node=cid, status=status, caveats=caveats or [])


def res(n_against: int = 0) -> StatusResult:
    from elute.models import Evidence
    against = [Evidence(id=f"EV_{i:012x}", source_provider="fixture", source_record_id=str(i), evidence_kind="publication", transport="fixture",
                        statement="x", source_name="x", source_url="u", publication_date="2000-01-01", ledger_step="L4", first_author="a", journal="j", year=2000)
               for i in range(n_against)]
    return StatusResult(status="contested", why="w", against=against)


def pick(a: Claim, b: Claim, ra: StatusResult | None = None, rb: StatusResult | None = None) -> str:
    return weakest([a, b], {a.id: ra or res(), b.id: rb or res()}).claim_id


def test_policy_table():
    assert WEAKNESS == {"established": 0, "single-source": 1, "unknown": 2, "contested": 3, "refuted": 4}


def test_established_is_never_weakest_when_anything_weaker_exists():
    for s in ("single-source", "unknown", "contested", "refuted"):
        assert pick(claim("C_MECHANISM", "established"), claim("C_CLINICAL", s)) == "C_CLINICAL"


def test_refuted_over_contested_over_unknown_over_single_source_over_established():
    assert pick(claim("C_EXPOSURE", "contested"), claim("C_CLINICAL", "refuted")) == "C_CLINICAL"
    assert pick(claim("C_ENGAGEMENT", "unknown"), claim("C_EXPOSURE", "contested")) == "C_EXPOSURE"
    assert pick(claim("C_CLINICAL", "single-source"), claim("C_ENGAGEMENT", "unknown")) == "C_ENGAGEMENT"
    assert pick(claim("C_MECHANISM", "established"), claim("C_CLINICAL", "single-source")) == "C_CLINICAL"


def test_ties_more_against_then_more_caveats_then_causal_order():
    a, b = claim("C_EXPOSURE", "contested"), claim("C_DOWNSTREAM", "contested")
    assert pick(a, b, res(1), res(2)) == "C_DOWNSTREAM"  # more against
    a2, b2 = claim("C_EXPOSURE", "contested", ["open-label"]), claim("C_DOWNSTREAM", "contested", ["open-label", "animal-model"])
    assert pick(a2, b2, res(1), res(1)) == "C_DOWNSTREAM"  # more caveats
    a3, b3 = claim("C_EXPOSURE", "contested", ["x"]), claim("C_DOWNSTREAM", "contested", ["y"])
    assert pick(a3, b3, res(1), res(1)) == "C_EXPOSURE"  # full tie → earlier in the causal chain


def test_why_carries_the_rule_and_the_consequence():
    w = weakest([claim("C_EXPOSURE", "contested"), claim("C_MECHANISM", "established")], {"C_EXPOSURE": res(1), "C_MECHANISM": res(0)})
    assert w.claim_id == "C_EXPOSURE" and "does not reach" in w.why and w.evidence_ids
