"""Canonical metadata records (BACKEND_PLAN v4.4 §9.1). Built from RawRecords BEFORE the temporal gate, so by
construction they carry no abstract text: the dataclass has no field for it. Abstracts exist only on
`AbstractRecord`, which is constructed from `fetch_abstracts(selected_visible_ids)` after the gate and the cap."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from elute.connectors.base import RawRecord, Transport
from elute.ids import normalize_doi, normalize_text, publication_record_id


@dataclass
class CanonRecord:
    key: str  # publication_record_id: pmid → pmcid → doi → title|year
    kind: str  # RawRecord.kind
    transport: Transport
    tool: str
    source_name: str
    url: str
    published: str | None
    date_basis: str
    pmid: str | None = None
    pmcid: str | None = None
    doi: str | None = None
    nct_id: str | None = None
    title: str = ""
    year: str | None = None
    journal: str | None = None
    authors: list[str] = field(default_factory=list)
    affiliation: str | None = None
    cited_by_count: int | None = None
    facets: list[str] = field(default_factory=list)
    text: str = ""  # title (+ the record's own statement); never an abstract
    payload: dict[str, Any] = field(default_factory=dict)  # the source's fields with any abstract removed
    raw_ids: list[str] = field(default_factory=list)


_STRIP = ("abstract", "abstractText", "full_text", "fullText")


def canonicalize(r: RawRecord, facet: str | None = None) -> CanonRecord:
    p = {k: v for k, v in r.payload.items() if k not in _STRIP}
    pmid = r.pmid or (str(p.get("pmid")) if p.get("pmid") else None)
    pmcid = p.get("pmcid") or None
    doi = normalize_doi(p.get("doi"))
    title = p.get("title") or p.get("brief_title") or ""
    year = str(p.get("pub_year") or p.get("year") or "") or None
    if r.kind == "article":
        key = publication_record_id(pmid, pmcid, doi, title, year)
    elif r.kind in ("trial-registration", "trial-results"):
        key = f"{r.nct_id}|{'results' if r.kind == 'trial-results' else 'registration'}"
    else:
        key = r.id
    authors = [a.get("name") if isinstance(a, dict) else str(a) for a in (p.get("authors") or [])]
    affil = None
    for a in p.get("authors") or []:
        if isinstance(a, dict) and a.get("affiliation"):
            affil = a["affiliation"]
            break
    text = title if r.kind == "article" else r.text
    cbc = p.get("cited_by_count")
    return CanonRecord(key=key, kind=r.kind, transport=r.transport, tool=r.tool, source_name=r.source_name, url=r.url, published=r.published,
                       date_basis=r.date_basis, pmid=pmid, pmcid=pmcid, doi=doi, nct_id=r.nct_id, title=title, year=year,
                       journal=p.get("journal"), authors=[a for a in authors if a], affiliation=affil,
                       cited_by_count=int(cbc) if isinstance(cbc, (int, float, str)) and str(cbc).isdigit() else None,
                       facets=[facet] if facet else [], text=text, payload=p, raw_ids=[r.id])


@dataclass
class AbstractRecord:
    """Abstract text for one selected, visible publication. Constructed only after the gate and the cap."""

    key: str
    pmid: str
    title: str
    abstract: str
    authors: list[str] = field(default_factory=list)
    affiliations: list[str] = field(default_factory=list)
    mesh_terms: list[str] = field(default_factory=list)
    publication_types: list[str] = field(default_factory=list)


assert "abstract" not in {f for f in CanonRecord.__dataclass_fields__}
