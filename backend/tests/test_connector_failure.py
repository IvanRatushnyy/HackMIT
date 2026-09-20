"""One provider failing through both transports never kills the appraisal (BACKEND_PLAN v4.4 §14): the step settles
`failed`, its Evidence is absent, the dependent gates are `unknown`, and the engine still derives a stance."""
from __future__ import annotations

from elute.connectors.base import ToolError
from elute.engine.labels import derive_status
from elute.fixtures import load_bundle
from elute.pipeline.appraisal import derive
from elute.pipeline.literature import retrieve_literature
from elute.pipeline.tools import run_task
from tests.conftest import task
from tests.constants import PRE_TRIAL_SNAPSHOT


def test_trials_provider_down_on_both_transports_settles_failed(tu, direct, monkeypatch):
    monkeypatch.setattr(tu, "call", lambda tool, arguments: (_ for _ in ()).throw(ToolError("down")))
    monkeypatch.setattr(direct, "call", lambda tool, arguments: (_ for _ in ()).throw(ToolError("also down")))
    ep = run_task(task("trials", "L3"), tu, direct)
    assert ep.status == "failed" and ep.records == []


def test_literature_down_leaves_other_evidence_and_dependent_gates_unknown(tu, direct, monkeypatch):
    monkeypatch.setattr(tu, "call", lambda tool, arguments: (_ for _ in ()).throw(ToolError("down")))
    monkeypatch.setattr(direct, "call", lambda tool, arguments: (_ for _ in ()).throw(ToolError("also down")))
    res = retrieve_literature(task("literature", "L4"), PRE_TRIAL_SNAPSHOT, tu, direct)
    assert res.status == "failed" and res.selected == [] and res.abstracts == {}
    # the rest of the record stands: trials + biology from the bundle, literature removed
    b = load_bundle()
    ev = [e for e in b.evidence if e.ledger_step != "L4" and e.publication_date <= PRE_TRIAL_SNAPSHOT]
    d = derive(b.drug, b.disease, b.resolved, ev)
    s = {c.id: c.status for c in d.claims}
    assert s["C_EXPOSURE"] == "unknown" and s["C_ENGAGEMENT"] == "unknown" and s["C_MECHANISM"] == "established"
    assert d.stance in ("no_clear_prioritization", "insufficient_evidence")
    assert derive_status("C_CLINICAL", ev).status == "unknown"  # registrations alone link nothing
