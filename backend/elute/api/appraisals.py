"""The appraisal endpoints (BACKEND_PLAN v4.4 §15): POST /appraisals, GET /appraisals/{id}, /events (SSE), /detail."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from elute.api.adapt import adapt, ledger_row
from elute.engine.validate import ValidationError
from elute.fixtures import load_bundle
from elute.llm.client import NullClient
from elute.models import CandidateAppraisal
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


def _run_live(app, run_id: str, drug: str, disease: str, as_of: str) -> None:
    from elute.pipeline.orchestrator_live import LiveRun

    store = app.state.store
    ap_holder: dict[str, CandidateAppraisal] = {}

    def emit(step: str, phase: str, entry) -> None:
        row = ledger_row(entry, list(getattr(runner, "evidence_all", []))) if phase == "settled" else None
        store.append_event(run_id, step, phase, {"entry": entry.model_dump(mode="json"), "row": row, "done": phase == "settled" and step == "L10"})

    runner = LiveRun(tu=app.state.tu, direct=app.state.direct, llm=app.state.llm, emit=emit, demo_disable_tool=app.state.settings.ELUTE_DEMO_DISABLE_TOOL)
    try:
        ap = runner.run(drug, disease, as_of, run_id=run_id)
        ap_holder["ap"] = ap
        store.put_appraisal(run_id, ap.model_dump(mode="json"))
        gaps = ap.data_mode == "mixed" or ap.llm != "openai" or any(e.status == "failed" for e in ap.ledger)
        store.set_status(run_id, "complete_with_gaps" if gaps else "complete")
    except TemporalLeak as e:
        log.error("run %s failed validation: temporal leak", run_id)
        store.set_status(run_id, "failed", f"temporal leak: {e}")
    except ValidationError as e:
        store.set_status(run_id, "failed", f"validation: {e}")
    except Exception as e:  # noqa: BLE001
        log.exception("run %s failed", run_id)
        store.set_status(run_id, "failed", f"{type(e).__name__}: {e}")


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
    _pool.submit(_run_live, app, run_id, req.drug, req.disease, as_of)
    return JSONResponse({"id": run_id, "status": "running"}, status_code=202)


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
