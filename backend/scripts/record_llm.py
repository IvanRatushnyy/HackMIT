"""Record OpenAI outputs as cassettes so the live pipeline replays deterministically offline (BACKEND_PLAN v4.4 §16, M7).
Requires OPENAI_API_KEY and OPENAI_MODEL in backend/.env. Runs the live pipeline on the recorded connector cassettes at
the three pinned snapshots; every model output is stored under tests/fixtures/llm/<Schema>/<prompt-hash>.json.
Usage: cd backend && uv run python scripts/record_llm.py"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from elute.connectors.direct import DirectConnector  # noqa: E402
from elute.connectors.tooluniverse import ToolUniverseConnector  # noqa: E402
from elute.llm.client import ReplayClient  # noqa: E402
from elute.llm.openai_client import OpenAIClient  # noqa: E402
from elute.pipeline.orchestrator_live import LiveRun  # noqa: E402
from elute.settings import get_settings  # noqa: E402
from elute.store import PayloadCache  # noqa: E402

FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
settings = get_settings()
if not settings.llm_credentials_present:
    sys.exit("OPENAI_API_KEY and OPENAI_MODEL must be set in backend/.env")
cache = PayloadCache(FIXTURES, offline=True)
tu, direct = ToolUniverseConnector(cache, offline=True), DirectConnector(cache, offline=True)
client = ReplayClient(FIXTURES / "llm", record_with=OpenAIClient(settings))
for as_of in ("2016-07-11", "2017-11-20", "2026-09-20"):
    seen = len(client.prompts)
    run = LiveRun(tu=tu, direct=direct, llm=client)
    ap = run.run("nilotinib", "Parkinson disease", as_of)
    l4 = next(e for e in run.ledger if e.step == "L4")
    abstracts = l4.key_finding.split("; ")[1] if "; " in (l4.key_finding or "") else "abstracts read: unknown"
    extractions = sum(1 for p in client.prompts[seen:] if p["schema"] == "ExtractionOut")
    print(as_of, "llm", ap.llm, "stance", ap.recommendation.stance, {c.id: c.status for c in ap.claims}, "·", abstracts, "· ExtractionOut calls", extractions)
    if extractions == 0:  # never record synthesis over a run that read nothing: the cassettes would encode a broken L4
        sys.exit(f"{as_of}: {abstracts} / 0 ExtractionOut calls — the PubMed_get_article cassettes do not cover the current selected records. "
                 "Run scripts/record_literature.py first.")
print("recorded prompts:", len(client.prompts), "→", FIXTURES / "llm")
