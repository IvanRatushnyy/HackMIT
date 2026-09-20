"""Stable identifiers (BACKEND_PLAN v4.4 §7). Evidence ids are content-derived, never retrieval-order; claim ids are
seven fixed constants; the causal order is the tie-break everywhere."""
from __future__ import annotations

import hashlib
import re
import unicodedata

CLAIM_IDS: tuple[str, ...] = ("C_MECHANISM", "C_DISEASE_RELEVANCE", "C_EXPOSURE", "C_ENGAGEMENT", "C_DOWNSTREAM", "C_CLINICAL", "C_SAFETY")
CAUSAL_ORDER: list[str] = list(CLAIM_IDS)
GATE_ORDER: list[str] = ["C_EXPOSURE", "C_ENGAGEMENT", "C_DOWNSTREAM", "C_CLINICAL"]  # the next-question order (§5)


def evidence_id(source_provider: str, source_record_id: str, evidence_kind: str, publication_date: str) -> str:
    """EV_ + the first 12 hex chars of sha256(provider|record_id|kind|date). Mutable prose is never part of the key."""
    canonical = f"{source_provider}|{source_record_id}|{evidence_kind}|{publication_date}"
    return "EV_" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]


def normalize_text(s: str | None) -> str:
    """Lowercase ASCII, punctuation stripped, whitespace collapsed — the dedup and independence normalizer."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def normalize_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    d = doi.strip().lower()
    for prefix in ("https://doi.org/", "http://doi.org/", "doi:"):
        if d.startswith(prefix):
            d = d[len(prefix):]
    return d or None


def publication_record_id(pmid: str | None, pmcid: str | None, doi: str | None, title: str | None, year: int | str | None) -> str:
    """PMID → PMCID → DOI → normalized title + year (§7, §11.3)."""
    if pmid:
        return f"pmid:{pmid}"
    if pmcid:
        return f"pmcid:{pmcid}"
    d = normalize_doi(doi)
    if d:
        return f"doi:{d}"
    return f"title:{normalize_text(title)}|{year or ''}"
