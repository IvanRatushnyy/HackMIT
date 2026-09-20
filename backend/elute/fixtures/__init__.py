"""The curated fixture bundle (BACKEND_PLAN v4.4 §7). The JSON on disk carries a human `key` per evidence and no ids;
`load_bundle` computes the content-derived ids, resolves `@key` citations, and validates the bundle. Statuses, the
weakest link, the next question and the stance are never stored here — the engine computes them from this bundle."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from elute.ids import evidence_id
from elute.models import FixtureBundle

FIXTURE_DIR = Path(__file__).parent
NILOTINIB = FIXTURE_DIR / "nilotinib_parkinsons.json"


def _resolve_cites(cites: list[str], aliases: dict[str, str]) -> list[str]:
    out = []
    for c in cites:
        if c.startswith("@"):
            if c[1:] not in aliases:
                raise KeyError(f"fixture cites unknown evidence key {c}")
            out.append(aliases[c[1:]])
        else:
            out.append(c)
    return out


def load_bundle(path: Path = NILOTINIB) -> FixtureBundle:
    raw: dict[str, Any] = json.loads(path.read_text())
    aliases: dict[str, str] = {}
    evidence = []
    for e in raw["evidence"]:
        e = dict(e)
        key = e.pop("key")
        e["id"] = evidence_id(e["source_provider"], e["source_record_id"], e["evidence_kind"], e["publication_date"])
        if key in aliases:
            raise KeyError(f"duplicate fixture key {key}")
        aliases[key] = e["id"]
        e.setdefault("transport", "fixture")
        e.setdefault("group", e.get("independence_group", "unknown"))
        evidence.append(e)
    synthesis = {}
    for date, s in raw["synthesis"].items():
        s = dict(s)
        for field in ("strongest_case_for", "strongest_case_against"):
            s[field] = [{"text": item["text"], "cites": _resolve_cites(item["cites"], aliases)} for item in s[field]]
        synthesis[date] = s
    bundle = FixtureBundle(drug=raw["drug"], disease=raw["disease"], resolved=raw["resolved"], evidence=evidence,
                           reasoning=raw["reasoning"], synthesis=synthesis)
    ids = [e.id for e in bundle.evidence]
    if len(ids) != len(set(ids)):
        raise ValueError("fixture evidence ids collide")
    return bundle


def aliases_for(path: Path = NILOTINIB) -> dict[str, str]:
    raw = json.loads(path.read_text())
    return {e["key"]: evidence_id(e["source_provider"], e["source_record_id"], e["evidence_kind"], e["publication_date"]) for e in raw["evidence"]}
