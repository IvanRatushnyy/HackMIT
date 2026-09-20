"""ToolUniverse as a transport (BACKEND_PLAN §9a). Loads only the verified tools, answers one call with the tool's
payload, and turns ToolUniverse's `{"status": "error"}` envelope and timeouts into ToolError so the in-step loop can
record the attempt and fall back. Verified live 2026-09-20 against tooluniverse==1.5.0 (see docs/BACKEND_PLAN.md §21)."""
from __future__ import annotations

import concurrent.futures
import threading
import time
from typing import Any

from elute.connectors.base import CacheMiss, ToolError
from elute.store import PayloadCache

# The exact registered names. Load nothing else: the full catalogue is ~2,900 tools.
TOOL_NAMES: tuple[str, ...] = (
    # L1 resolve
    "OpenTargets_get_drug_chembId_by_generic_name",
    "OpenTargets_get_disease_id_description_by_name",
    "OpenTargets_get_target_id_description_by_name",
    # L2 biology / target evidence
    "OpenTargets_get_drug_mechanisms_of_action_by_chemblId",
    "OpenTargets_get_evidence_by_datasource",
    # L3 clinical trials
    "ClinicalTrials_search_studies",
    "get_clinical_trial_status_and_dates",
    "get_clinical_trial_conditions_and_interventions",
    "extract_clinical_trial_outcomes",
    # L4 literature
    "PubMed_search_articles",
    "PubMed_get_article",
)

TRANSPORT = "tooluniverse"


class ToolUniverseConnector:
    def __init__(self, cache: PayloadCache | None = None, *, timeout_s: float = 25.0, offline: bool = False):
        self.cache = cache
        self.timeout_s = timeout_s
        self.offline = offline or bool(cache and cache.offline)
        self._tu = None
        self._lock = threading.Lock()
        self._pool = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="tooluniverse")

    # -- lifecycle --------------------------------------------------------
    def _engine(self):
        with self._lock:
            if self._tu is None:
                from tooluniverse import ToolUniverse  # imported lazily: slow, heavy, never needed offline

                tu = ToolUniverse()
                tu.load_tools(include_tools=list(TOOL_NAMES))
                loaded = {t["name"] for t in tu.all_tools}
                missing = set(TOOL_NAMES) - loaded
                if missing:
                    raise ToolError(f"ToolUniverse did not load: {sorted(missing)}", kind="unavailable")
                self._tu = tu
        return self._tu

    def available(self) -> bool:
        try:
            self._engine()
            return True
        except Exception:  # noqa: BLE001 — health only
            return False

    # -- the one call ------------------------------------------------------
    def call(self, tool: str, arguments: dict[str, Any]) -> tuple[Any, int, bool]:
        """Returns (payload, elapsed_ms, from_cache). Raises ToolError on error, timeout, or unknown tool."""
        if tool not in TOOL_NAMES:
            raise ToolError(f"{tool} is not one of the verified tools", kind="not-in-list")
        if self.cache is not None:
            cached = self.cache.get(TRANSPORT, tool, arguments)  # raises CacheMiss when offline
            if cached is not None:
                return cached, 0, True
        if self.offline:
            raise CacheMiss(f"offline and {tool} not cached")
        t0 = time.monotonic()
        fut = self._pool.submit(self._engine().run, {"name": tool, "arguments": arguments})
        try:
            payload = fut.result(timeout=self.timeout_s)
        except concurrent.futures.TimeoutError as e:
            raise ToolError(f"{tool} timed out after {self.timeout_s:.0f}s", retriable=True, kind="timeout") from e
        except Exception as e:  # noqa: BLE001
            raise ToolError(f"{tool} raised {type(e).__name__}: {e}", retriable=True) from e
        elapsed = int((time.monotonic() - t0) * 1000)
        if isinstance(payload, dict) and payload.get("status") == "error":
            details = payload.get("error_details") or {}
            raise ToolError(str(payload.get("error")), retriable=bool(details.get("retriable")), kind=str(details.get("type", "error")))
        if self.cache is not None:
            self.cache.put(TRANSPORT, tool, arguments, payload)
        return payload, elapsed, False

