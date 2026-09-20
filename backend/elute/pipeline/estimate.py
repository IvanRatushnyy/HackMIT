"""How long a live appraisal will take, step by step, so the Working page can say so before it starts.

The basis is always named: the last completed live run of the same pair when the store has one, else the last
completed live run of any pair, else fixed defaults. Nothing here is a promise; the page shows it as an estimate and
says when a step has overrun it."""
from __future__ import annotations

from typing import Any

STEPS = [f"L{i}" for i in range(1, 11)]

# Defaults from rehearsals on venue-like Wi-Fi: the three retrieval steps dominate, the engine steps are instant.
DEFAULT_STEP_MS: dict[str, int] = {"L1": 4_000, "L2": 13_000, "L3": 8_000, "L4": 55_000, "L5": 300, "L6": 300, "L7": 300, "L8": 300, "L9": 1_500, "L10": 800}
# With a model configured, L4 extracts one abstract at a time and L9/L10 wait on the model.
LLM_EXTRA_MS: dict[str, int] = {"L4": 45_000, "L9": 15_000, "L10": 5_000}


def default_estimate(llm_configured: bool) -> dict[str, Any]:
    steps = {s: DEFAULT_STEP_MS[s] + (LLM_EXTRA_MS.get(s, 0) if llm_configured else 0) for s in STEPS}
    return {"total_ms": sum(steps.values()), "steps": steps, "basis": "defaults" + (" with a model configured" if llm_configured else ", no model configured")}


CACHE_SERVED_MS = 3_000  # a run faster than this answered from the payload cache and says nothing about the network


def estimate_from_store(store, drug: str, disease: str, llm_configured: bool) -> dict[str, Any]:
    """Per-step elapsed_ms of the last completed live run that actually touched the network (a cache-served run is
    skipped); every step is floored at 200 ms so the bar always moves."""
    run, by_step = None, {}
    for candidate in store.completed_runs("live", drug, disease):
        ap = store.get_appraisal(candidate["id"]) or {}
        steps_ms = {e.get("step"): int(e.get("elapsed_ms") or 0) for e in (ap.get("ledger") or [])}
        if all(s in steps_ms for s in STEPS) and sum(steps_ms.values()) >= CACHE_SERVED_MS:
            run, by_step = candidate, steps_ms
            break
    if run is None:
        return default_estimate(llm_configured)
    steps = {s: max(200, by_step[s]) for s in STEPS}
    same_pair = run["drug"].lower() == drug.lower() and run["disease"].lower() == disease.lower()
    when = (run.get("updated_at") or "")[:16].replace("T", " ")
    basis = f"the last recorded run of {run['drug']} for {run['disease']} ({when} UTC)" if same_pair else f"the last recorded run ({run['drug']} for {run['disease']}, {when} UTC)"
    return {"total_ms": sum(steps.values()), "steps": steps, "basis": basis}
