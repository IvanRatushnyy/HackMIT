"""§8: the adapter's CandidateDetail passes the FRONTEND's own validator (run through vite-node when available) at every
cutoff, and the frontend's label derivation agrees with the engine on the exact-status claims."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from elute.api.adapt import adapt
from elute.fixtures import load_bundle
from elute.pipeline.orchestrator import run_fixture
from elute.pipeline.orchestrator_live import LiveRun
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT

REPO = Path(__file__).resolve().parents[2]
VITE_NODE = REPO / "node_modules" / ".bin" / "vite-node"
EXACT = ("C_MECHANISM", "C_DISEASE_RELEVANCE", "C_EXPOSURE", "C_CLINICAL")


def python_check(cand: dict) -> list[str]:
    """A port of the validator's structural rules, for environments without node."""
    problems = []
    ids = {s["id"] for s in cand["sources"]}
    if len(cand["prerequisites"]) != 5:
        problems.append("expected 5 prerequisites")
    if not cand["objections"]:
        problems.append("no objections")
    for s in cand["sources"]:
        if not all(s.get(k) for k in ("published", "group", "url", "ledger")):
            problems.append(f"source {s['id']} missing fields")
    for k in cand["chain"]["claims"]:
        for e in k["evidence"]:
            if e["source"] not in ids:
                problems.append(f"{k['id']} unknown source")
            if e["direction"] == "refutes":
                src = next(s for s in cand["sources"] if s["id"] == e["source"])
                if not (src["controlled"] and src.get("blinded") is True and src.get("outcome") == "negative"):
                    problems.append(f"{k['id']} refutes gate")
    for cut in cand["cutoffs"]:
        d = cut["date"]
        for p in cand["prerequisites"]:
            if not [x for x in p["status"] if x["from"] <= d]:
                problems.append(f"prerequisite {p['id']} unresolved at {cut['id']}")
        if not [x for x in cand["best_evidence"] if x["from"] <= d]:
            problems.append(f"best_evidence unresolved at {cut['id']}")
        w = [x for x in cand["weakest_link"] if x["from"] <= d]
        if not w or w[-1]["value"]["claim"] not in {k["id"] for k in cand["chain"]["claims"]}:
            problems.append(f"weakest_link unresolved at {cut['id']}")
    return problems


def frontend_check(doc: dict, tmp_path: Path) -> dict | None:
    if not VITE_NODE.exists() or not shutil.which("node"):
        return None
    p = tmp_path / "detail.json"
    p.write_text(json.dumps(doc))
    r = subprocess.run([str(VITE_NODE), "scripts/validate-detail.ts", str(p)], cwd=REPO, capture_output=True, text=True, timeout=120)
    out = r.stdout.strip().splitlines()
    return json.loads(out[-1]) if out else {"problems": [f"vite-node produced no output: {r.stderr[-400:]}"], "labels": {}}


@pytest.mark.parametrize("as_of", [EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT, CURRENT_GOLDEN_SNAPSHOT])
def test_fixture_adapter_is_publishable_and_labels_agree(tmp_path, as_of):
    ap = run_fixture(load_bundle(), as_of)
    doc = adapt(ap, ledger_kind="scripted")
    assert python_check(doc["candidate"]) == []
    fe = frontend_check(doc, tmp_path)
    if fe is None:
        pytest.skip("node/vite-node not available")
    assert fe["problems"] == [], fe["problems"]
    engine = {c.id: c.status for c in ap.claims}
    for cid in EXACT:
        assert fe["labels"][as_of][cid] == engine[cid], (cid, fe["labels"][as_of][cid], engine[cid])


def test_live_adapter_is_publishable(tmp_path, tu, direct):
    ap = LiveRun(tu=tu, direct=direct).run("nilotinib", "Parkinson disease", CURRENT_GOLDEN_SNAPSHOT)
    doc = adapt(ap)
    assert python_check(doc["candidate"]) == []
    fe = frontend_check(doc, tmp_path)
    if fe is not None:
        assert fe["problems"] == [], fe["problems"]
