"""The appraisal endpoints (BACKEND_PLAN v4.4 §15): POST /appraisals, GET /appraisals/{id}, /events (SSE), /detail.

Live runs also (a) carry a per-step time estimate whose basis is named, (b) stream `progress` events between a step's
`question` and `settled` so the Working page can say what the agent is doing right now, and (c) are written, when they
complete, to the demo directory (gitignored) so the browser can replay a real run sped up without a backend."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from elute.api.adapt import adapt, ledger_row, slugify
from elute.engine.validate import ValidationError
from elute.fixtures import load_bundle
from elute.llm.client import NullClient
from elute.models import CandidateAppraisal
from elute.pipeline.estimate import default_estimate, estimate_from_store
from elute.pipeline.orchestrator import new_id, run_fixture
from elute.pipeline.temporal import TemporalLeak

log = logging.getLogger("elute.api")
router = APIRouter()
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="elute-run")


def err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


class AppraisalRequest(BaseModel):
    drug: str
    disease: str
    as_of: str | None = None


def startup(app) -> None:
    """Connectors, the model client and the fixture bundle. Tests may pre-set app.state.overrides."""
    settings = app.state.settings
    ov = getattr(app.state, "overrides", {}) or {}
    app.state.bundle = ov.get("bundle") or load_bundle()
    app.state.llm = ov.get("llm")
    if app.state.llm is None:
        if settings.ELUTE_MODE == "live" and settings.llm_credentials_present and app.state.health.llm_configured:
            from elute.llm.openai_client import OpenAIClient

            app.state.llm = OpenAIClient(settings)
        elif settings.ELUTE_MODE == "live" and settings.ELUTE_LLM_CASSETTES and Path(settings.ELUTE_LLM_CASSETTES).is_dir():
            # No key: recorded OpenAI outputs are replayed by prompt hash. An output is reused only when the prompt is
            # byte-identical, so nothing is ever invented; a miss degrades exactly as NullClient does.
            from elute.llm.client import ReplayClient

            app.state.llm = ReplayClient(Path(settings.ELUTE_LLM_CASSETTES))
            log.info("no OpenAI key: replaying recorded model outputs from %s", settings.ELUTE_LLM_CASSETTES)
        else:
            app.state.llm = NullClient()
    app.state.tu = ov.get("tu")
    app.state.direct = ov.get("direct")
    if settings.ELUTE_MODE == "live" and (app.state.tu is None or app.state.direct is None):
        from elute.connectors.direct import DirectConnector
        from elute.connectors.tooluniverse import ToolUniverseConnector
        from elute.store import PayloadCache

        cache = PayloadCache(settings.ELUTE_CACHE_DIR)
        app.state.tu = app.state.tu or ToolUniverseConnector(cache)
        app.state.direct = app.state.direct or DirectConnector(cache)


def _validate_as_of(s: str | None, settings) -> str:
    if s is None:
        return settings.ELUTE_TODAY or date.today().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        raise ValueError("as_of must be ISO YYYY-MM-DD")
    date.fromisoformat(s)
    return s


def _llm_client_name(app) -> str:
    return getattr(app.state.llm, "name", "null")


def _estimate(app, drug: str, disease: str) -> dict[str, Any]:
    llm = _llm_client_name(app) != "null"
    try:
        return estimate_from_store(app.state.store, drug, disease, llm)
    except Exception:  # noqa: BLE001 — an estimate must never break a run
        return default_estimate(llm)


def _run_live(app, run_id: str, drug: str, disease: str, as_of: str) -> None:
    from elute.pipeline.orchestrator_live import LiveRun

    store = app.state.store
    t_start = time.monotonic()
    at_ms = lambda: int((time.monotonic() - t_start) * 1000)  # noqa: E731

    def emit(step: str, phase: str, entry) -> None:
        row = ledger_row(entry, list(getattr(runner, "evidence_all", []))) if phase == "settled" else None
        store.append_event(run_id, step, phase, {"entry": entry.model_dump(mode="json"), "row": row, "at_ms": at_ms(), "done": phase == "settled" and step == "L10"})

    def progress(step: str, note: str) -> None:
        store.append_event(run_id, step, "progress", {"note": note, "at_ms": at_ms(), "done": False})

    runner = LiveRun(tu=app.state.tu, direct=app.state.direct, llm=app.state.llm, emit=emit, progress=progress, demo_disable_tool=app.state.settings.ELUTE_DEMO_DISABLE_TOOL)
    try:
        ap = runner.run(drug, disease, as_of, run_id=run_id)
        store.put_appraisal(run_id, ap.model_dump(mode="json"))
        gaps = ap.data_mode == "mixed" or ap.llm != "openai" or any(e.status == "failed" for e in ap.ledger)
        status = "complete_with_gaps" if gaps else "complete"
        store.set_status(run_id, status)
        _write_demo(app, run_id, ap, status, at_ms())
    except TemporalLeak as e:
        log.error("run %s failed validation: temporal leak", run_id)
        store.set_status(run_id, "failed", f"temporal leak: {e}")
    except ValidationError as e:
        store.set_status(run_id, "failed", f"validation: {e}")
    except Exception as e:  # noqa: BLE001
        log.exception("run %s failed", run_id)
        store.set_status(run_id, "failed", f"{type(e).__name__}: {e}")


def _write_demo(app, run_id: str, ap: CandidateAppraisal, status: str, elapsed_ms: int) -> Path | None:
    """One JSON per pair (the latest run) plus one per run under runs/, in the demo directory. Never raises."""
    settings, store = app.state.settings, app.state.store
    try:
        run = store.get_run(run_id) or {}
        events = [{"seq": seq, "step": step, "phase": phase, **{k: v for k, v in entry.items() if k != "entry"},
                   **({"reasoning": entry["entry"].get("reasoning"), "question": entry["entry"].get("question")} if phase == "question" and entry.get("entry") else {})}
                  for seq, step, phase, entry in store.events(run_id)]
        # named by the pair as asked, which is the slug the frontend's URL carries (src/lib/pair.ts mirrors slugify)
        drug_asked, disease_asked = run.get("drug") or ap.drug, run.get("disease") or ap.disease
        slug = f"{slugify(drug_asked)}--{slugify(disease_asked)}"
        doc = {
            "version": 1,
            "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "run": {"id": run_id, "slug": slug, "drug": ap.drug, "disease": ap.disease, "as_of": ap.as_of, "mode": run.get("mode", "live"), "status": status,
                    "started_at": run.get("created_at"), "elapsed_ms": elapsed_ms, "data_mode": ap.data_mode, "llm": ap.llm, "llm_client": _llm_client_name(app),
                    "resolved": ap.resolved.model_dump(mode="json")},
            "estimate": _estimate(app, ap.drug, ap.disease),
            "events": events,
            "detail": adapt(ap, ledger_kind="recorded"),
            "appraisal": ap.model_dump(mode="json"),
        }
        root = Path(settings.demo_dir)
        (root / "runs").mkdir(parents=True, exist_ok=True)
        text = json.dumps(doc, indent=1, ensure_ascii=False, default=str)
        latest = root / f"{slug}.json"
        latest.write_text(text)
        (root / "runs" / f"{slug}--{run_id}.json").write_text(text)
        # the index Entry reads to offer the recorded pairs, worded as they were asked
        index_path = root / "index.json"
        try:
            index = json.loads(index_path.read_text()) if index_path.exists() else {"version": 1, "recordings": []}
        except Exception:  # noqa: BLE001
            index = {"version": 1, "recordings": []}
        entry = {"slug": slug, "drug": drug_asked, "disease": disease_asked, "text": f"{drug_asked} for {disease_asked}", "as_of": ap.as_of, "recorded_at": doc["recorded_at"],
                 "elapsed_ms": elapsed_ms, "llm": ap.llm, "llm_client": doc["run"]["llm_client"], "status": status, "run_id": run_id}
        index["recordings"] = [r for r in index.get("recordings", []) if r.get("slug") != slug] + [entry]
        index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False))
        log.info("run %s written for replay: %s (%d events, %d ms)", run_id, latest, len(events), elapsed_ms)
        return latest
    except Exception as e:  # noqa: BLE001 — the run is complete whether or not the demo file could be written
        log.warning("run %s: demo file not written: %s: %s", run_id, type(e).__name__, e)
        return None


@router.post("/appraisals")
def create_appraisal(req: AppraisalRequest, request: Request):
    app = request.app
    settings, store = app.state.settings, app.state.store
    try:
        as_of = _validate_as_of(req.as_of, settings)
    except ValueError as e:
        return err(422, "invalid_as_of", str(e))
    run_id = new_id()
    if settings.ELUTE_MODE == "fixture":
        b = app.state.bundle
        if req.drug.strip().lower() not in (b.drug.lower(), (b.resolved.drug_name or "").lower()) or not _same_disease(req.disease, b.disease):
            return err(422, "unresolvable_entity", f"fixture mode covers only {b.drug} for {b.disease}")
        store.create_run(run_id, req.drug, req.disease, as_of, "fixture", status="running")
        ap = run_fixture(b, as_of, run_id=run_id)
        for e in ap.ledger:
            store.append_event(run_id, e.step, "settled", {"entry": e.model_dump(mode="json"), "row": ledger_row(e, ap.evidence), "done": e.step == "L10"})
        store.put_appraisal(run_id, ap.model_dump(mode="json"))
        store.set_status(run_id, "complete")
        return JSONResponse({"id": run_id, "status": "complete"}, status_code=200)
    store.create_run(run_id, req.drug, req.disease, as_of, "live", status="running")
    estimate = _estimate(app, req.drug, req.disease)
    _pool.submit(_run_live, app, run_id, req.drug, req.disease, as_of)
    return JSONResponse({"id": run_id, "status": "running", "estimate": estimate}, status_code=202)


def _same_disease(a: str, b: str) -> bool:
    n = lambda s: re.sub(r"[^a-z]", "", s.lower().replace("'s", "").replace("’s", ""))  # noqa: E731
    return n(a) == n(b) or n(a) == n(b) + "disease" or n(a) + "disease" == n(b)


@router.get("/appraisals/{run_id}")
def get_appraisal(run_id: str, request: Request):
    store = request.app.state.store
    run = store.get_run(run_id)
    if run is None:
        return err(404, "not_found", f"no appraisal {run_id}")
    body: dict[str, Any] = {"id": run_id, "status": run["status"], "appraisal": store.get_appraisal(run_id) if run["status"].startswith("complete") else None}
    if run["status"] == "running" and run["mode"] == "live":
        body["estimate"] = _estimate(request.app, run["drug"], run["disease"])
    if run["status"] == "failed":
        body["error"] = {"code": "pipeline_error", "message": run["error"] or "the pipeline raised"}
    return body


@router.get("/appraisals/{run_id}/events")
async def events(run_id: str, request: Request):
    store = request.app.state.store
    if store.get_run(run_id) is None:
        return err(404, "not_found", f"no appraisal {run_id}")

    async def gen():
        after = 0
        while True:
            for seq, step, phase, entry in store.events(run_id, after):
                after = seq
                yield {"event": "ledger", "id": str(seq), "data": json.dumps({"step": step, "phase": phase, **entry})}
                if entry.get("done"):
                    return
            run = store.get_run(run_id)
            if run and run["status"] == "failed":
                yield {"event": "error", "data": json.dumps({"error": {"code": "pipeline_error", "message": run["error"]}})}
                return
            if await request.is_disconnected():
                return
            await asyncio.sleep(0.3)

    return EventSourceResponse(gen())


@router.get("/appraisals/{run_id}/detail")
def detail(run_id: str, request: Request, as_of: str | None = None):
    store = request.app.state.store
    run = store.get_run(run_id)
    if run is None:
        return err(404, "not_found", f"no appraisal {run_id}")
    if run["status"] == "running":
        return err(409, "running", "the appraisal is still running")
    raw = store.get_appraisal(run_id)
    if raw is None:
        return err(409, "running", run.get("error") or "no appraisal available")
    ap = CandidateAppraisal.model_validate(raw)
    if as_of and as_of != ap.as_of:
        if request.app.state.settings.ELUTE_MODE == "fixture":
            ap = run_fixture(request.app.state.bundle, as_of, run_id=run_id)
        else:
            return err(422, "invalid_as_of", "a live appraisal is fixed at its requested as_of; start a new appraisal for another date")
    return adapt(ap, ledger_kind="scripted" if run["mode"] == "fixture" else "recorded")
