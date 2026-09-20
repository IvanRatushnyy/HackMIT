"""The historical backtest (BACKEND_PLAN v4.4 §17) on the curated bundle. Live cassettes join in M5."""
from __future__ import annotations

import pytest

from elute.fixtures import aliases_for, load_bundle
from elute.pipeline.orchestrator import run_fixture
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT


@pytest.fixture(scope="module")
def alias():
    return aliases_for()


def statuses(ap):
    return {c.id: c.status for c in ap.claims}


def cited_against(ap):
    return {c for item in ap.strongest_case_against for c in item.cites}


def test_early_snapshot(alias):
    ap = run_fixture(load_bundle(), EARLY_SNAPSHOT)
    s = statuses(ap)
    assert s["C_CLINICAL"] == "single-source" and s["C_EXPOSURE"] == "contested"
    ids = {e.id for e in ap.evidence}
    assert alias["pagan-2016"] in ids and alias["schwarzschild-2016"] not in ids
    assert not any(e.source_record_id.startswith(("NCT02954978", "NCT03205488")) for e in ap.evidence)  # §17: neither later trial is visible yet (NCT02954978 first posted 2016-11-04, NILO-PD NCT03205488 2017-07-02); the pilot's own registration NCT02281474 (2014) legitimately is
    assert all(e.publication_date <= EARLY_SNAPSHOT for e in ap.evidence)
    assert ap.recommendation.stance in ("no_clear_prioritization", "insufficient_evidence")
    assert ap.weakest_link.claim_id == "C_EXPOSURE" and ap.next_question.gate == "C_EXPOSURE"
    assert ap.llm == "unavailable" and ap.recommendation.opinion.startswith("Based on the evidence visible as of 2016-07-11")


def test_pre_trial_snapshot(alias):
    ap = run_fixture(load_bundle(), PRE_TRIAL_SNAPSHOT)
    s = statuses(ap)
    ids = {e.id for e in ap.evidence}
    # two distinct trials, registration-only, no results from either
    assert alias["nct02954978-registration"] in ids and alias["nct03205488-registration"] in ids
    assert alias["nct03205488-results"] not in ids and alias["nct02954978-results"] not in ids
    assert alias["simuni-2021"] not in ids and alias["pagan-2020"] not in ids
    assert all(e.publication_date <= PRE_TRIAL_SNAPSHOT for e in ap.evidence)
    # the three pre-trial concerns, each cited
    against = cited_against(ap)
    assert {alias["pagan-2016"], alias["reinwald-2014"], alias["schwarzschild-2016"]} <= against
    texts = " ".join(i.text for i in ap.strongest_case_against)
    assert "12 patients" in texts and "0.53 %" in texts and "MAO-B" in texts
    assert s["C_CLINICAL"] == "contested" and s["C_DOWNSTREAM"] == "contested" and s["C_EXPOSURE"] == "contested"
    assert ap.next_question.gate == "C_EXPOSURE"
    # the weakest link is whatever the approved policy derives on the corrected bundle (§17): contested ties break on
    # count-against (all 1), then caveats — C_DOWNSTREAM's support (two mouse studies + the pilot) carries one more caveat
    # than C_EXPOSURE's (the pilot alone), so the engine names C_DOWNSTREAM. Recorded here, not forced.
    assert ap.weakest_link.claim_id == "C_DOWNSTREAM"
    assert ap.recommendation.stance == "no_clear_prioritization"


def test_current_golden_snapshot(alias):
    ap = run_fixture(load_bundle(), CURRENT_GOLDEN_SNAPSHOT)
    s = statuses(ap)
    ids = {e.id for e in ap.evidence}
    # both result records visible, each its own Evidence with its own id and date; neither substitutes for the other
    assert alias["nct03205488-results"] in ids and alias["nct02954978-results"] in ids
    r1 = next(e for e in ap.evidence if e.id == alias["nct03205488-results"]); r2 = next(e for e in ap.evidence if e.id == alias["nct02954978-results"])
    assert (r1.publication_date, r2.publication_date) == ("2020-07-22", "2026-06-12")
    # C_CLINICAL from ALL visible links: Simuni 2021 refutes (passes the gate); Pagan 2020 contradicts (efficacy was secondary)
    clinical = ap.claim("C_CLINICAL")
    assert clinical.status == "refuted" and {alias["simuni-2021"], alias["pagan-2020"]} <= set(clinical.evidence_ids)
    assert s["C_MECHANISM"] == "established" and s["C_EXPOSURE"] == "contested" and s["C_ENGAGEMENT"] == "unknown" and s["C_DOWNSTREAM"] in ("established", "contested")
    assert ap.recommendation.stance == "deprioritize"
    assert set(ap.recommendation.rationale_claim_ids) >= {"C_EXPOSURE", "C_ENGAGEMENT", "C_CLINICAL"}
    assert "deprioritize" in ap.recommendation.opinion
    assert {alias["simuni-2021"], alias["pagan-2020"]} <= cited_against(ap)
    assert ap.weakest_link.claim_id == "C_CLINICAL"  # refuted is the weakest by policy
    assert ap.next_question.gate == "C_EXPOSURE"


def test_curated_synthesis_passes_the_gate_at_every_snapshot():
    for d in (EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT, CURRENT_GOLDEN_SNAPSHOT):
        ap = run_fixture(load_bundle(), d)
        assert ap.llm == "unavailable", d  # curated prose passed the gate (fallback would read "fallback")
        assert all(item.cites for item in ap.strongest_case_for + ap.strongest_case_against)
        assert ap.recommendation.what_would_change_my_mind and ap.recommendation.key_unknowns == ["C_ENGAGEMENT"]


def test_ledger_has_ten_entries_with_reasoning():
    ap = run_fixture(load_bundle(), PRE_TRIAL_SNAPSHOT)
    assert [e.step for e in ap.ledger] == [f"L{i}" for i in range(1, 11)]
    assert all(e.reasoning.question and e.reasoning.next_action for e in ap.ledger)
    l6 = next(e for e in ap.ledger if e.step == "L6")
    assert "withheld" in l6.reasoning.interpretation and "2017-11-20" in l6.reasoning.question
