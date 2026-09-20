"""Record the cassettes M3 needs, live, through BOTH transports: metadata-only facet searches (canonical and
reformulated), the Europe PMC date supplement, and PubMed_get_article for the records the live pipeline selects at
each pinned snapshot. PubMed_get_article cassettes are keyed by the exact PMID batch, so they are recorded by running
the real LiveRun (not a hand-built task): whenever L4 ranking, cap, dedup or dynamic focus changes, re-run this
script before scripts/record_llm.py.
Usage: uv run python scripts/record_literature.py [cache_root]"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from elute.connectors.base import Attempt, Task  # noqa: E402
from elute.connectors.direct import DirectConnector  # noqa: E402
from elute.connectors.tooluniverse import ToolUniverseConnector  # noqa: E402
from elute.llm.client import ReplayClient  # noqa: E402
from elute.pipeline.literature import DEFAULT_FACET_ORDER  # noqa: E402
from elute.pipeline.orchestrator_live import LiveRun  # noqa: E402
from elute.pipeline.tools import DefaultSelector  # noqa: E402
from elute.store import PayloadCache  # noqa: E402

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "tests" / "fixtures"
cache = PayloadCache(ROOT)
tu, direct = ToolUniverseConnector(cache), DirectConnector(cache)
base = Task("L4", "literature", "What does the literature say?", drug="nilotinib", disease="Parkinson disease", drug_chembl_id="CHEMBL255863",
            disease_efo_id="MONDO_0005180", disease_aliases=["Parkinson disease", "Parkinson's disease", "Parkinsons disease", "Parkinsonian"],
            target_symbol="ABL1", target_aliases=["c-Abl", "Abl"], target_ensembl_id="ENSG00000097007")

# 1. canonical and reformulated searches per facet on both transports (metadata only)
for facet in DEFAULT_FACET_ORDER:
    t = Task(**{**base.__dict__, "facet": facet})
    sel = DefaultSelector().select(t, [])
    sel2 = DefaultSelector().select(t, [Attempt(1, "tooluniverse", sel.tool, sel.arguments, "insufficient", 0, 0, "recording")])
    for label, s in (("canonical", sel), ("reformulated", sel2)):
        for transport, conn in (("tooluniverse", tu), ("direct", direct)):
            try:
                _, ms, cached = conn.call(s.tool, s.arguments)
                print(f"{facet:20s} {label:12s} {transport:12s} {ms:5d} ms {'cached' if cached else 'live'}")
            except Exception as e:  # noqa: BLE001
                print(f"{facet:20s} {label:12s} {transport:12s} FAILED {e}")

# 2. the full §9.1 path at each snapshot through the real LiveRun: dates supplement + abstracts for exactly the batches
#    the pipeline selects. A keyless ReplayClient (misses return None, no OpenAI needed) keeps the L4 dynamic follow-up
#    path live so its batches are recorded too. ToolUniverse records on the way through; the direct fallback is then
#    recorded for the identical batches so it replays offline.
llm = ReplayClient(ROOT / "llm")
for as_of in ("2016-07-11", "2017-11-20", "2026-09-20"):
    run = LiveRun(tu=tu, direct=direct, llm=llm)
    run.run("nilotinib", "Parkinson disease", as_of)
    l4 = next(e for e in run.ledger if e.step == "L4")
    batches = {a.query["pmid"]: a.query for a in l4.attempts if isinstance(a.query, dict) and "pmid" in a.query}  # direct rows carry no tool_name
    recorded = {"tooluniverse": 0, "direct": 0}
    missed: list[str] = []
    for args in batches.values():
        for transport, conn in (("tooluniverse", tu), ("direct", direct)):
            try:
                conn.call("PubMed_get_article", args)
                recorded[transport] += 1
            except Exception as e:  # noqa: BLE001
                print(f"{as_of}: {transport} get_article FAILED for {args['pmid']}: {e}")
        if not (cache.path("tooluniverse", "PubMed_get_article", args).exists() or cache.path("direct", "PubMed_get_article", args).exists()):
            missed.append(args["pmid"])
    print(f"{as_of}: selected {l4.counts.results_selected_for_extraction} · {l4.key_finding.split('; ')[1] if '; ' in (l4.key_finding or '') else l4.key_finding} · "
          f"get_article batches {len(batches)}: recorded via tooluniverse {recorded['tooluniverse']}, via direct {recorded['direct']}")
    if missed:
        sys.exit(f"{as_of}: no transport recorded PubMed_get_article for batch(es) {missed}; offline replay would read no abstracts")
