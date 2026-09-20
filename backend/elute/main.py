"""Elute backend entry point (BACKEND_PLAN v4.4 §3, §15).

    cd backend && uv sync --extra dev && uv run uvicorn elute.main:app --reload --port 8000

Creates the FastAPI app under /api, includes the routers, configures CORS for the frontend, opens the SQLite store and
loads fixtures at startup, probes the connectors in live mode, and exposes /api/health.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from elute.api import health
from elute.api.health import HealthState
from elute.settings import Settings, get_settings
from elute.store import RunStore

log = logging.getLogger("elute")


def probe_llm(settings: Settings) -> bool:
    """True only when a key and a model are set AND a one-token probe succeeds. Cached for the process lifetime."""
    if not settings.llm_credentials_present:
        return False
    try:
        from elute.llm.openai_client import OpenAIClient

        return OpenAIClient(settings).probe()
    except Exception as e:  # noqa: BLE001 — health must never raise
        log.warning("OpenAI probe failed: %s", type(e).__name__)
        return False


def probe_connectors(settings: Settings) -> dict[str, dict[str, str]]:
    """Live mode only: is each task's preferred ToolUniverse tool loadable, and does its direct fallback answer?"""
    state = {t: {"preferred": "unverified", "fallback": "unverified"} for t in health.TASKS}
    if settings.ELUTE_MODE != "live":
        return state
    try:
        from elute.connectors.tooluniverse import ToolUniverseConnector

        ok = ToolUniverseConnector(timeout_s=60).available()
        for t in state:
            state[t]["preferred"] = "ok" if ok else "down"
    except Exception:  # noqa: BLE001
        for t in state:
            state[t]["preferred"] = "down"
    try:
        import httpx

        from elute.connectors.direct import CLINICAL_TRIALS_V2, EUROPE_PMC_SEARCH, OPEN_TARGETS_GRAPHQL

        with httpx.Client(timeout=5.0) as c:
            checks = {"biology": ("POST", OPEN_TARGETS_GRAPHQL, {"json": {"query": "{meta{name}}"}}),
                      "clinical_trials": ("GET", CLINICAL_TRIALS_V2, {"params": {"pageSize": 1, "format": "json"}}),
                      "literature": ("GET", EUROPE_PMC_SEARCH, {"params": {"query": "nilotinib", "format": "json", "pageSize": 1}})}
            for t, (method, url, kw) in checks.items():
                try:
                    r = c.request(method, url, **kw)
                    state[t]["fallback"] = "ok" if r.status_code < 500 else "down"
                except httpx.HTTPError:
                    state[t]["fallback"] = "down"
    except Exception:  # noqa: BLE001
        pass
    return state


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.ELUTE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        settings.ELUTE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        app.state.settings = settings
        app.state.store = RunStore(settings.ELUTE_DB_PATH)
        app.state.health = HealthState(mode=settings.ELUTE_MODE, llm_configured=probe_llm(settings), connectors=probe_connectors(settings))
        log.info("elute started %s", settings.redacted())
        try:
            from elute.api import appraisals

            appraisals.startup(app)
        except ImportError:  # the appraisal router lands in M6
            pass
        yield
        app.state.store.close()

    app = FastAPI(title="Elute", version="0.1.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])
    app.include_router(health.router, prefix="/api")
    try:
        from elute.api import appraisals

        app.include_router(appraisals.router, prefix="/api")
    except ImportError:
        pass
    return app


app = create_app()
