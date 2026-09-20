"""Persistence (BACKEND_PLAN v4.4 §16): the connector payload cache and the SQLite run store.

PayloadCache — keyed by (transport, tool, canonical arguments); one JSON file per call.
Makes rehearsed queries deterministic on venue Wi-Fi and lets tests replay real payloads with no network.
In `offline` mode a miss raises CacheMiss instead of touching the network."""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from elute.connectors.base import CacheMiss


class PayloadCache:
    def __init__(self, root: str | os.PathLike | None = None, *, offline: bool = False):
        self.root = Path(root or os.environ.get("ELUTE_CACHE_DIR", ".cache")) / "payloads"
        self.offline = offline

    @staticmethod
    def key(transport: str, tool: str, arguments: dict[str, Any]) -> str:
        canonical = json.dumps({"transport": transport, "tool": tool, "arguments": arguments}, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()[:20]

    def path(self, transport: str, tool: str, arguments: dict[str, Any]) -> Path:
        safe = re.sub(r"[^A-Za-z0-9_.-]", "_", tool)
        return self.root / transport / safe / f"{self.key(transport, tool, arguments)}.json"

    def get(self, transport: str, tool: str, arguments: dict[str, Any]) -> Any | None:
        p = self.path(transport, tool, arguments)
        if p.exists():
            return json.loads(p.read_text())["payload"]
        if self.offline:
            raise CacheMiss(f"{transport}:{tool} {json.dumps(arguments, default=str)} not cached at {p}")
        return None

    def put(self, transport: str, tool: str, arguments: dict[str, Any], payload: Any) -> Path:
        p = self.path(transport, tool, arguments)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"transport": transport, "tool": tool, "arguments": arguments,
                                 "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                 "payload": payload}, indent=1, default=str))
        return p


# ---------------------------------------------------------------------------
# SQLite run store: runs, events (the reasoning trace as it happens), appraisals.
# ---------------------------------------------------------------------------

import sqlite3
import threading

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, drug TEXT NOT NULL, disease TEXT NOT NULL, as_of TEXT NOT NULL, mode TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT
);
CREATE TABLE IF NOT EXISTS events (
  run_id TEXT NOT NULL, seq INTEGER NOT NULL, step TEXT NOT NULL, phase TEXT NOT NULL, entry TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY (run_id, seq)
);
CREATE TABLE IF NOT EXISTS appraisals (
  run_id TEXT PRIMARY KEY, appraisal TEXT NOT NULL, created_at TEXT NOT NULL
);
"""


class RunStore:
    """Append-only event log per run. A process dying mid-run loses nothing; /events replays from here."""

    def __init__(self, path: str | os.PathLike):
        self.path = Path(path)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False, isolation_level=None)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(_SCHEMA)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # -- runs -------------------------------------------------------------
    def create_run(self, run_id: str, drug: str, disease: str, as_of: str, mode: str, status: str = "running") -> None:
        now = self._now()
        with self._lock:
            self._conn.execute("INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,NULL)", (run_id, drug, disease, as_of, mode, status, now, now))

    def set_status(self, run_id: str, status: str, error: str | None = None) -> None:
        with self._lock:
            self._conn.execute("UPDATE runs SET status=?, error=?, updated_at=? WHERE id=?", (status, error, self._now(), run_id))

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT id, drug, disease, as_of, mode, status, created_at, updated_at, error FROM runs WHERE id=?", (run_id,)).fetchone()
        if row is None:
            return None
        keys = ("id", "drug", "disease", "as_of", "mode", "status", "created_at", "updated_at", "error")
        return dict(zip(keys, row))

    def completed_runs(self, mode: str, drug: str | None = None, disease: str | None = None, limit: int = 10) -> list[dict[str, Any]]:
        """Recent runs of this mode that completed (with or without gaps), newest first: the basis of the time estimate.
        With a drug and disease, the same pair's runs come first, then any other completed run of the mode."""
        keys = ("id", "drug", "disease", "as_of", "mode", "status", "created_at", "updated_at", "error")
        base = "SELECT id, drug, disease, as_of, mode, status, created_at, updated_at, error FROM runs WHERE mode=? AND status LIKE 'complete%'"
        with self._lock:
            rows = []
            if drug and disease:
                rows = self._conn.execute(base + " AND lower(drug)=lower(?) AND lower(disease)=lower(?) ORDER BY updated_at DESC LIMIT ?", (mode, drug, disease, limit)).fetchall()
            seen = {r[0] for r in rows}
            rows += [r for r in self._conn.execute(base + " ORDER BY updated_at DESC LIMIT ?", (mode, limit)).fetchall() if r[0] not in seen]
        return [dict(zip(keys, r)) for r in rows]

    # -- events -----------------------------------------------------------
    def append_event(self, run_id: str, step: str, phase: str, entry: dict[str, Any]) -> int:
        with self._lock:
            seq = self._conn.execute("SELECT COALESCE(MAX(seq), 0) + 1 FROM events WHERE run_id=?", (run_id,)).fetchone()[0]
            self._conn.execute("INSERT INTO events VALUES (?,?,?,?,?,?)", (run_id, seq, step, phase, json.dumps(entry, default=str), self._now()))
        return seq

    def events(self, run_id: str, after: int = 0) -> list[tuple[int, str, str, dict[str, Any]]]:
        with self._lock:
            rows = self._conn.execute("SELECT seq, step, phase, entry FROM events WHERE run_id=? AND seq>? ORDER BY seq", (run_id, after)).fetchall()
        return [(seq, step, phase, json.loads(entry)) for seq, step, phase, entry in rows]

    # -- appraisals -------------------------------------------------------
    def put_appraisal(self, run_id: str, appraisal: dict[str, Any]) -> None:
        with self._lock:
            self._conn.execute("INSERT OR REPLACE INTO appraisals VALUES (?,?,?)", (run_id, json.dumps(appraisal, default=str), self._now()))

    def get_appraisal(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT appraisal FROM appraisals WHERE run_id=?", (run_id,)).fetchone()
        return json.loads(row[0]) if row else None
