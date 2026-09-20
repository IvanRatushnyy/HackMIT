"""The six ordered status rules on the curated bundle at the three pinned dates."""
from __future__ import annotations

import pytest

from elute.engine.labels import derive_status
from elute.fixtures import load_bundle
from elute.pipeline.temporal import visible
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT

EXPECTED = {
    "C_MECHANISM": ("established", "established", "established"),
    "C_DISEASE_RELEVANCE": ("established", "established", "established"),
    "C_EXPOSURE": ("contested", "contested", "contested"),
    "C_ENGAGEMENT": ("unknown", "unknown", "unknown"),
    "C_DOWNSTREAM": ("established", "contested", "contested"),
    "C_CLINICAL": ("single-source", "contested", "refuted"),
    "C_SAFETY": ("contested", "contested", "contested"),
}


@pytest.mark.parametrize("claim_id,expected", EXPECTED.items())
def test_status_cells(claim_id, expected):
    b = load_bundle()
    got = tuple(derive_status(claim_id, visible(b.evidence, d)).status for d in (EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT, CURRENT_GOLDEN_SNAPSHOT))
    assert got == expected, (claim_id, got)


def test_single_source_qualifier_and_established_why():
    b = load_bundle()
    r = derive_status("C_CLINICAL", visible(b.evidence, EARLY_SNAPSHOT))
    assert r.status == "single-source" and "Pagan" in r.why and "open-label study of 12" in r.why
    m = derive_status("C_MECHANISM", visible(b.evidence, EARLY_SNAPSHOT))
    assert m.status == "established" and "regulator" in m.why
    d = derive_status("C_DISEASE_RELEVANCE", visible(b.evidence, EARLY_SNAPSHOT))
    assert "3 independent groups" in d.why


def test_refutes_requires_the_gate_else_contested():
    b = load_bundle()
    ev = visible(b.evidence, CURRENT_GOLDEN_SNAPSHOT)
    simuni = next(e for e in ev if e.source_record_id == "pmid:33315105")
    assert derive_status("C_CLINICAL", ev).status == "refuted"
    weakened = simuni.model_copy(update={"blinded": False})
    ev2 = [weakened if e.id == simuni.id else e for e in ev]
    assert derive_status("C_CLINICAL", ev2).status == "contested"
