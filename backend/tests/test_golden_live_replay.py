"""M7 on live cassettes WITH the model: runs only when OpenAI outputs have been recorded (scripts/record_llm.py).
Asserts the §17 presence/absence expectations that need claim-level extraction."""
from __future__ import annotations

from pathlib import Path

import pytest

from elute.llm.client import ReplayClient
from elute.pipeline.orchestrator_live import LiveRun
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT

LLM_DIR = Path(__file__).parent / "fixtures" / "llm"
pytestmark = pytest.mark.skipif(not (LLM_DIR / "ExtractionOut").exists(), reason="no recorded OpenAI cassettes; run scripts/record_llm.py with a key")


@pytest.fixture
def llm():
    return ReplayClient(LLM_DIR)


def test_early(tu, direct, llm):
    ap = LiveRun(tu=tu, direct=direct, llm=llm).run("nilotinib", "Parkinson disease", EARLY_SNAPSHOT)
    s = {c.id: c.status for c in ap.claims}
    assert s["C_CLINICAL"] in ("single-source", "unknown") and s["C_EXPOSURE"] in ("contested", "single-source", "unknown")
    assert not any(e.source_record_id.startswith(("NCT02954978", "NCT03205488")) for e in ap.evidence)  # §17: neither later trial is visible yet (NCT02954978 first posted 2016-11-04, NILO-PD NCT03205488 2017-07-02); the pilot's own registration NCT02281474 (2014) legitimately is
    assert ap.recommendation.stance in ("no_clear_prioritization", "insufficient_evidence")


def test_pre_trial(tu, direct, llm):
    ap = LiveRun(tu=tu, direct=direct, llm=llm).run("nilotinib", "Parkinson disease", PRE_TRIAL_SNAPSHOT)
    assert not any(e.evidence_kind == "results" for e in ap.evidence)
    assert ap.claim("C_CLINICAL").status != "refuted"
    assert ap.next_question.gate == "C_EXPOSURE" or ap.claim("C_EXPOSURE").status == "established"


def test_current(tu, direct, llm):
    ap = LiveRun(tu=tu, direct=direct, llm=llm).run("nilotinib", "Parkinson disease", CURRENT_GOLDEN_SNAPSHOT)
    assert {e.source_record_id for e in ap.evidence if e.evidence_kind == "results"} >= {"NCT03205488|results", "NCT02954978|results"}
    if ap.claim("C_CLINICAL").status == "refuted":
        assert ap.recommendation.stance == "deprioritize"
    assert ap.llm in ("openai", "fallback")
