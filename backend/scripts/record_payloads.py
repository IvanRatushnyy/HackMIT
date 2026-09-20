"""Run the canonical nilotinib / Parkinson's tasks live through BOTH transports and record every payload into the
test fixture cache, so `pytest` replays real responses with no network. Re-run to refresh.
Usage: backend/.venv/bin/python backend/scripts/record_payloads.py [cache_root]"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from elute.connectors.base import Attempt, Task  # noqa: E402
from elute.connectors.direct import DirectConnector  # noqa: E402
from elute.connectors.tooluniverse import ToolUniverseConnector  # noqa: E402
from elute.pipeline.tools import LITERATURE_FACETS, DefaultSelector, run_task  # noqa: E402
from elute.store import PayloadCache  # noqa: E402

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "tests" / "fixtures"
cache = PayloadCache(ROOT)
tu, direct = ToolUniverseConnector(cache), DirectConnector(cache)

base = dict(drug="nilotinib", disease="Parkinson disease", drug_chembl_id="CHEMBL255863", disease_efo_id="MONDO_0005180",
            disease_aliases=["Parkinson disease", "Parkinson's disease", "Parkinsons disease", "Parkinsonian"], target_symbol="ABL1",
            target_aliases=["c-Abl", "Abl"],
            target_ensembl_id="ENSG00000097007")
tasks = [
    Task("L1", "resolve", "What exactly was asked?", drug="nilotinib", disease="Parkinson disease", disease_aliases=base["disease_aliases"]),
    Task("L1", "resolve", "What exactly was asked?", drug="nilotinib", disease="Parkinson disease", drug_chembl_id="CHEMBL255863", disease_aliases=base["disease_aliases"]),
    Task("L1", "resolve", "What exactly was asked?", drug="nilotinib", disease="Parkinson disease", target_symbol="ABL1"),
    Task("L2", "biology", "What is the target?", **{k: v for k, v in base.items() if k != "target_ensembl_id"}),
    Task("L2", "biology", "Is the target tied to the disease?", **base),
    Task("L3", "trials", "Has this been tested in people?", **base),
] + [Task("L4", "literature", "What does the literature say?", facet=f, **base) for f in LITERATURE_FACETS]

for task in tasks:
    for transport in ("tooluniverse", "direct"):
        # force each transport as the counting attempt by handing the loop only that connector for attempt 1
        sel = DefaultSelector().select(task, [])
        conn = tu if transport == "tooluniverse" else direct
        try:
            payload, ms, cached = conn.call(sel.tool, sel.arguments)
            print(f"{task.id} {task.facet or task.kind:20s} {transport:12s} {sel.tool:55s} {ms:5d} ms {'cached' if cached else 'live'}")
        except Exception as e:  # noqa: BLE001
            print(f"{task.id} {task.facet or task.kind:20s} {transport:12s} {sel.tool:55s} FAILED {e}")
    # the reformulated query too (path B needs it offline), on both transports
    if task.kind in ("trials", "literature"):
        prior = [Attempt(1, "tooluniverse", sel.tool, sel.arguments, "insufficient", 0, 0, "recording")]
        sel2 = DefaultSelector().select(task, prior)
        for transport, conn in (("tooluniverse", tu), ("direct", direct)):
            try:
                payload, ms, cached = conn.call(sel2.tool, sel2.arguments)
                print(f"{task.id} {task.facet or task.kind:20s} {transport:12s} {sel2.tool:55s} {ms:5d} ms {'cached' if cached else 'live'} (reformulated)")
            except Exception as e:  # noqa: BLE001
                print(f"{task.id} {task.facet or task.kind:20s} {transport:12s} {sel2.tool:55s} FAILED {e} (reformulated)")
    # the supplements (direct) through the real loop, ToolUniverse first
    ep = run_task(task, tu, direct)
    print(f"   → episode {ep.status} via {ep.transport} · {len(ep.records)} records · attempts {[a.outcome for a in ep.attempts]}")
