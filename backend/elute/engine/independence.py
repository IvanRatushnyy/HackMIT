"""Independence groups — the Phase 1 proxy (BACKEND_PLAN v4.4 §10). Conservative: when in doubt, `unknown`, and two
unknowns never count as two groups. OpenAlex improves this in Phase 2 (informational only)."""
from __future__ import annotations

import re
from typing import Iterable

from elute.ids import normalize_text

_AFFIL_NOISE = re.compile(r"\b(department|dept|division|school|faculty|institute|center|centre|of|the|and|for)\b")


def normalize_author(name: str | None) -> str | None:
    """'Simuni T' / 'Tanya Simuni' / 'Pagan, Fernando L.' → 'simuni-t' / 'pagan-f'. None when unreadable."""
    if not name:
        return None
    raw = name.strip()
    if "," in raw:  # "Last, First M."
        last, first = [p.strip() for p in raw.split(",", 1)]
    else:
        parts = raw.split()
        if len(parts) == 1:
            return normalize_text(parts[0]).replace(" ", "-") or None
        # PubMed style "Simuni T" (initials last) vs "Tanya Simuni" (first name first): initials are ≤ 2 uppercase letters
        if re.fullmatch(r"[A-Z]{1,3}", parts[-1]):
            last, first = " ".join(parts[:-1]), parts[-1]
        else:
            last, first = parts[-1], parts[0]
    last_n = normalize_text(last).replace(" ", "-")
    initial = normalize_text(first)[:1]
    if not last_n:
        return None
    return f"{last_n}-{initial}" if initial else last_n


_INSTITUTION = re.compile(r"\b(university|universit|hospital|institut|college|school|clinic|medical|inc|ltd|gmbh|foundation|laborator|research)\w*", re.I)


def normalize_affiliation(affiliation: str | None) -> str:
    """The segment that names the institution (not the department), lowercased, noise words removed."""
    if not affiliation:
        return ""
    segments = [s.strip() for s in affiliation.split(",") if s.strip()]
    chosen = next((s for s in segments if _INSTITUTION.search(s) and not s.lower().startswith(("department", "dept", "division"))), segments[0] if segments else "")
    return re.sub(r"\s+", " ", _AFFIL_NOISE.sub(" ", normalize_text(chosen))).strip()


def independence_group(authors: Iterable[str | None], affiliation: str | None) -> str:
    """Rules 1–4 of §10: last author + affiliation → first author + affiliation → author only → unknown."""
    names = [a for a in (normalize_author(x) for x in authors) if a]
    affil = normalize_affiliation(affiliation)
    if names:
        key_author = names[-1] if len(names) > 1 else names[0]
        return f"{key_author}|{affil}"
    return "unknown"


def key_authors(authors: Iterable[str | None]) -> set[str]:
    names = [a for a in (normalize_author(x) for x in authors) if a]
    if not names:
        return set()
    return {names[0], names[-1]}


def distinct_groups(items: list[tuple[str, set[str]]]) -> int:
    """Count independent groups among (group_key, key_authors) pairs: unknown never counts; overlapping first/last
    authors merge two records into one group (rule 6)."""
    groups: list[tuple[str, set[str]]] = []
    for key, ka in items:
        if key == "unknown" or key.startswith("unknown|"):
            continue
        merged = False
        for i, (gk, gka) in enumerate(groups):
            if gk == key or (ka and gka and ka & gka):
                groups[i] = (gk, gka | ka)
                merged = True
                break
        if not merged:
            groups.append((key, set(ka)))
    return len(groups)
