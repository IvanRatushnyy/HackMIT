"""M5: the live pipeline end to end on cassettes, honest degradation without a model, the temporal sentinel, and the
transparent fault injection."""
from __future__ import annotations

import logging

import pytest

from elute.connectors.base import ToolError
from elute.llm.client import RecordingClient
from elute.pipeline.orchestrator_live import LiveRun
from elute.pipeline.tools import DEMO_DISABLED_REASON
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT

SENTINEL = "FUTURE_RESULT_SENTINEL"


class Silent:
    """A configured-looking model that answers nothing: extraction runs (prompts are captured) and degrades."""
    name = "silent"

    def complete_structured(self, schema, system, user):
        return None


@pytest.mark.parametrize("as_of", [EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT, CURRENT_GOLDEN_SNAPSHOT])
def test_live_run_completes_on_cassettes_without_a_model(tu, direct, as_of):
    events = []
    ap = LiveRun(tu=tu, direct=direct, emit=lambda step, phase, entry: events.append((step, phase))).run("nilotinib", "Parkinson disease", as_of)
    assert [e.step for e in ap.ledger] == [f"L{i}" for i in range(1, 11)]
    assert ap.data_mode == "live" and ap.llm == "unavailable"
    assert ap.resolved.drug_chembl_id == "CHEMBL255863" and ap.resolved.disease_efo_id == "MONDO_0005180" and ap.resolved.target_symbol == "ABL1"
    assert all(e.publication_date <= as_of for e in ap.evidence)
    s = {c.id: c.status for c in ap.claims}
    assert s["C_MECHANISM"] == "established"  # the FDA-label mechanism row (a `label` source) passes rule 5
    assert s["C_EXPOSURE"] == "unknown" and s["C_CLINICAL"] == "unknown"  # no extraction → no claim-level findings, never invented
    assert ap.recommendation.stance in ("no_clear_prioritization", "insufficient_evidence")
    l2, l3, l4 = (next(e for e in ap.ledger if e.step == st) for st in ("L2", "L3", "L4"))
    assert l2.transport == "tooluniverse" and l3.transport == "tooluniverse" and l4.transport == "tooluniverse"
    assert l3.tool_name == "ClinicalTrials_search_studies" and l4.tool_name == "PubMed_search_articles"
    assert {a.tool_name for a in l2.attempts if a.tool_name} >= {"OpenTargets_get_drug_mechanisms_of_action_by_chemblId"}
    assert l4.counts.results_selected_for_extraction <= 20 and l4.counts.records_withheld == l4.counts.results_after_dedup - l4.counts.results_after_temporal_filter
    assert ("L1", "question") in events and ("L10", "settled") in events
    if as_of == PRE_TRIAL_SNAPSHOT:
        regs = {e.source_record_id for e in ap.evidence if e.evidence_kind == "registration"}
        assert {"NCT03205488|registration", "NCT02954978|registration"} <= regs
        assert not any(e.evidence_kind == "results" for e in ap.evidence)
    if as_of == CURRENT_GOLDEN_SNAPSHOT:
        assert {e.source_record_id for e in ap.evidence if e.evidence_kind == "results"} >= {"NCT03205488|results", "NCT02954978|results"}


def test_future_sentinel_never_leaks(tu, direct, monkeypatch, caplog):
    """§9.3: a post-cutoff paper and a post-cutoff trial result never reach the model, the reasoning, the claims, the
    evidence, the synthesis, the recommendation, or user-facing logs."""
    real_tu, real_direct = tu.call, direct.call

    def tu_call(tool, arguments):
        payload, ms, cached = real_tu(tool, arguments)
        if tool == "PubMed_search_articles":
            payload = dict(payload); payload["data"] = list(payload["data"]) + [
                {"pmid": "99999991", "title": f"{SENTINEL} nilotinib Parkinson disease trial", "pub_date": "2021 Jan 15", "pub_year": "2021", "journal": "Future J",
                 "authors": [{"name": "Future A"}], "url": "https://pubmed.ncbi.nlm.nih.gov/99999991/"}]
        if tool == "ClinicalTrials_search_studies":
            payload = dict(payload); payload["data"] = dict(payload["data"]); payload["data"]["studies"] = list(payload["data"]["studies"]) + [
                {"nct_id": "NCT99999999", "brief_title": f"{SENTINEL} nilotinib Parkinson disease", "status": "COMPLETED", "study_type": "INTERVENTIONAL", "phases": ["PHASE2"],
                 "enrollment": 999, "conditions": ["Parkinson disease"], "interventions": ["nilotinib"], "sponsor": "Future", "start_date": "2020-12-14", "completion_date": "2021-01-01"}]
        return payload, ms, cached

    def direct_call(tool, arguments):
        if tool == "PubMed_get_article" and "99999991" in arguments.get("pmid", ""):
            raise AssertionError("abstract text was requested for a post-cutoff record")
        return real_direct(tool, arguments)

    monkeypatch.setattr(tu, "call", tu_call)
    monkeypatch.setattr(direct, "call", direct_call)
    client = RecordingClient(Silent())
    caplog.set_level(logging.INFO)
    ap = LiveRun(tu=tu, direct=direct, llm=client).run("nilotinib", "Parkinson disease", PRE_TRIAL_SNAPSHOT)
    for p in client.prompts:
        assert SENTINEL not in p["user"] and SENTINEL not in p["system"]
    blob = ap.model_dump_json()
    assert SENTINEL not in blob
    assert SENTINEL not in caplog.text
    l4 = next(e for e in ap.ledger if e.step == "L4")
    assert l4.counts.records_withheld >= 1
    assert client.prompts, "the model must have been asked something for this test to mean anything"


def test_demo_fault_injection_is_labelled_and_recovers(tu, direct):
    ap = LiveRun(tu=tu, direct=direct, demo_disable_tool="literature").run("nilotinib", "Parkinson disease", PRE_TRIAL_SNAPSHOT)
    l4 = next(e for e in ap.ledger if e.step == "L4")
    first = l4.attempts[0]
    assert first.outcome == "error" and first.reason == DEMO_DISABLED_REASON and first.transport == "tooluniverse"
    assert l4.transport == "direct" and l4.status in ("retried", "ok") and l4.record_ids
    l3 = next(e for e in ap.ledger if e.step == "L3")
    assert l3.transport == "tooluniverse"  # only the named task was disabled


def test_provider_down_through_both_transports_yields_complete_with_gaps_shape(tu, direct, monkeypatch):
    real_tu, real_direct = tu.call, direct.call
    monkeypatch.setattr(tu, "call", lambda tool, a: (_ for _ in ()).throw(ToolError("down")) if tool == "ClinicalTrials_search_studies" else real_tu(tool, a))
    monkeypatch.setattr(direct, "call", lambda tool, a: (_ for _ in ()).throw(ToolError("down")) if tool == "ClinicalTrials_search_studies" else real_direct(tool, a))
    ap = LiveRun(tu=tu, direct=direct).run("nilotinib", "Parkinson disease", CURRENT_GOLDEN_SNAPSHOT)
    l3 = next(e for e in ap.ledger if e.step == "L3")
    assert l3.status == "failed" and ap.data_mode == "mixed" and not any(e.source_provider == "clinicaltrials_gov" for e in ap.evidence)
    assert ap.claim("C_MECHANISM").status == "established"  # the rest of the record stands
