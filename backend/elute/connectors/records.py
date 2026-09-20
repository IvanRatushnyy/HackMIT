"""Payload → RawRecord mappers, one per ToolUniverse tool, shared by every transport.
The direct connectors emulate the ToolUniverse response shape for each tool, so a record is identical
whichever transport delivered it (stop condition 27). Dates here are only what the payload itself states;
`enrich.py` adds the day-level dates that need a second lookup."""
from __future__ import annotations

import re
from typing import Any

from elute.connectors import dates
from elute.connectors.base import RawRecord, Task, Transport


def _data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def _rec(task: Task, transport: Transport, tool: str, key: str, **kw: Any) -> RawRecord:
    return RawRecord(id=f"{task.id}:{tool}:{key}", task_id=task.id, transport=transport, tool=tool, **kw)


# ---- L1 resolve -------------------------------------------------------------

def entity_records(task: Task, transport: Transport, tool: str, payload: Any) -> list[RawRecord]:
    hits = (_data(payload) or {}).get("search", {}).get("hits", []) or []
    out = []
    for h in hits:
        ident = h.get("id", "")
        is_drug = ident.startswith("CHEMBL")
        url = (f"https://platform.opentargets.org/drug/{ident}" if is_drug
               else f"https://platform.opentargets.org/disease/{ident}" if re.match(r"^(MONDO|EFO|Orphanet|HP|OBA)_", ident)
               else f"https://platform.opentargets.org/target/{ident}")
        out.append(_rec(task, transport, tool, ident, kind="entity", source_name="Open Targets Platform search", url=url,
                        published=None, date_basis="undated (identifier, not evidence)",
                        text=f"{h.get('name', '')} {h.get('description', '')}", payload=h))
    return out


# ---- L2 biology -------------------------------------------------------------

_LABEL_YEAR = re.compile(r"/label/(\d{4})/")


def mechanism_records(task: Task, transport: Transport, tool: str, payload: Any) -> list[RawRecord]:
    """Open Targets `drug.mechanismsOfAction.rows[]` (ChEMBL-curated). A row referencing an FDA label is dated by the
    label year in the URL, resolved to the last day of that year; a row with no dated reference stays undated."""
    drug = (_data(payload) or {}).get("drug") or {}
    rows = (drug.get("mechanismsOfAction") or {}).get("rows") or []
    out = []
    for i, row in enumerate(rows):
        refs = row.get("references") or []
        urls = [u for r in refs for u in (r.get("urls") or [])]
        fda = [u for u in urls if "accessdata.fda.gov" in u]
        candidates = [(m[1], "FDA label URL year") for u in fda if (m := _LABEL_YEAR.search(u))]
        published, basis = dates.resolve(candidates)
        symbols = [t.get("approvedSymbol", "") for t in row.get("targets") or []]
        out.append(_rec(task, transport, tool, f"moa{i}", kind="mechanism",
                        source_name="Open Targets · ChEMBL mechanism" + (" (FDA label)" if fda else ""),
                        url=fda[0] if fda else (urls[0] if urls else f"https://platform.opentargets.org/drug/{drug.get('id', '')}"),
                        published=published, date_basis=basis,
                        text=f"{drug.get('name', '')} {row.get('mechanismOfAction', '')} {row.get('actionType', '')} {row.get('targetName', '')} {' '.join(symbols)}",
                        payload={**row, "drug_id": drug.get("id"), "drug_name": drug.get("name")}))
    return out


def association_records(task: Task, transport: Transport, tool: str, payload: Any) -> list[RawRecord]:
    """Open Targets `disease.evidences.rows[]` for one target. Each row states its datasource; a row with a PMID is
    dated by that paper in `enrich.literature_dates`, a row without one stays undated (never Evidence)."""
    disease = (_data(payload) or {}).get("disease") or {}
    rows = (disease.get("evidences") or {}).get("rows") or []
    out = []
    for i, row in enumerate(rows):
        pmids = [str(p) for p in (row.get("literature") or [])]
        target = row.get("target") or {}
        urls = [u.get("url") for u in (row.get("urls") or []) if u.get("url")]
        out.append(_rec(task, transport, tool, f"ev{i}", kind="association",
                        source_name=f"Open Targets · {row.get('datasourceId', '?')} ({row.get('datatypeId', '?')})",
                        url=urls[0] if urls else (f"https://europepmc.org/abstract/MED/{pmids[0]}" if pmids else
                                                  f"https://platform.opentargets.org/evidence/{target.get('id', '')}/{disease.get('id', '')}"),
                        published=None, date_basis="undated",
                        text=f"{target.get('approvedSymbol', '')} {disease.get('name', '')} {row.get('datasourceId', '')}",
                        payload={**row, "disease_id": disease.get("id"), "disease_name": disease.get("name")},
                        pmid=pmids[0] if pmids else None))
    return out


# ---- L3 trials --------------------------------------------------------------

def trial_records(task: Task, transport: Transport, tool: str, payload: Any) -> list[RawRecord]:
    """ToolUniverse v2 `studies[]` (flattened). One registration record per study, dated by the tool's `start_date`
    as a proxy until `enrich.trial_design` replaces it with `studyFirstPostDate` and adds the results record."""
    studies = (_data(payload) or {}).get("studies") or []
    out = []
    for s in studies:
        nct = s.get("nct_id")
        if not nct:
            continue
        published, basis = dates.resolve([(s.get("start_date"), "start_date proxy")])
        out.append(_rec(task, transport, tool, nct, kind="trial-registration",
                        source_name=f"ClinicalTrials.gov {nct}", url=f"https://clinicaltrials.gov/study/{nct}",
                        published=published, date_basis=basis,
                        text=" ".join([s.get("brief_title") or "", " ".join(s.get("conditions") or []),
                                       " ".join(s.get("interventions") or [])]),
                        payload=dict(s), nct_id=nct))
    return out


# ---- L4 literature ----------------------------------------------------------

def article_records(task: Task, transport: Transport, tool: str, payload: Any) -> list[RawRecord]:
    """ToolUniverse `PubMed_search_articles` / `PubMed_get_article` shape: `data[]{pmid, title, abstract, journal,
    pub_date, ...}`. `pub_date` is a candidate; Europe PMC's day-level date is added in `enrich.literature_dates`."""
    hits = _data(payload) or []
    out = []
    for h in hits:
        pmid = str(h.get("pmid") or "")
        if not pmid or h.get("partial"):
            continue
        published, basis = dates.resolve([(h.get("pub_date"), "PubMed pub_date")])
        out.append(_rec(task, transport, tool, pmid, kind="article",
                        source_name=f"{_first_author(h)} {h.get('pub_year') or ''}, {h.get('journal') or ''}".strip(),
                        url=h.get("url") or f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                        published=published, date_basis=basis,
                        text=f"{h.get('title') or ''} {h.get('abstract') or ''}", payload=dict(h), pmid=pmid))
    return out


def _first_author(h: dict[str, Any]) -> str:
    authors = h.get("authors") or []
    if not authors:
        return "Unknown"
    a = authors[0]
    return (a.get("name") if isinstance(a, dict) else str(a)) or "Unknown"


MAPPERS = {
    "OpenTargets_get_drug_chembId_by_generic_name": entity_records,
    "OpenTargets_get_disease_id_description_by_name": entity_records,
    "OpenTargets_get_target_id_description_by_name": entity_records,
    "OpenTargets_get_drug_mechanisms_of_action_by_chemblId": mechanism_records,
    "OpenTargets_get_evidence_by_datasource": association_records,
    "ClinicalTrials_search_studies": trial_records,
    "PubMed_search_articles": article_records,
    "PubMed_get_article": article_records,
}


def records_for(tool: str, task: Task, transport: Transport, payload: Any) -> list[RawRecord]:
    mapper = MAPPERS.get(tool)
    if mapper is None:
        raise KeyError(f"no record mapper for tool {tool}")
    return mapper(task, transport, tool, payload)
