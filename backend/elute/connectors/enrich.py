"""Recorded supplements, applied to records whichever transport delivered them.
Each supplement is one more Attempt on the step (transport = direct), so the trace shows it."""
from __future__ import annotations

import re
import time
from dataclasses import replace

from elute.connectors import dates
from elute.connectors.base import Attempt, CacheMiss, RawRecord, Task, ToolError
from elute.connectors.direct import DirectConnector
from elute.connectors.tooluniverse import ToolUniverseConnector


def literature_dates(task: Task, records: list[RawRecord], direct: DirectConnector, n: int) -> tuple[list[RawRecord], Attempt | None]:
    """Europe PMC `firstPublicationDate` for every record with a PMID. The record's date becomes the earliest
    day-level date among PubMed `pub_date` and Europe PMC; partial dates resolve late (see dates.py)."""
    pmids = sorted({r.pmid for r in records if r.pmid})
    if not pmids:
        return records, None
    args = {"pmids": pmids}
    t0 = time.monotonic()
    try:
        found, elapsed, _ = direct.call("europepmc.dates", args)
        outcome, reason = "ok", None
    except (ToolError, CacheMiss) as e:
        found, elapsed, outcome, reason = {}, int((time.monotonic() - t0) * 1000), "error", str(e)
    out = []
    for r in records:
        if not r.pmid:
            out.append(r)
            continue
        hit = found.get(r.pmid)
        epmc_date = hit.get("first_publication_date") if isinstance(hit, dict) else hit  # older cassettes hold the bare date
        cited = hit.get("cited_by_count") if isinstance(hit, dict) else None
        candidates = [(r.payload.get("pub_date"), "PubMed pub_date"), (epmc_date, "Europe PMC firstPublicationDate")]
        published, basis = dates.resolve(candidates)
        payload = {**r.payload, "cited_by_count": cited} if isinstance(cited, int) else r.payload
        out.append(replace(r, published=published, date_basis=basis, payload=payload))
    return out, Attempt(n=n, transport="direct", tool="europepmc.dates", query=args, outcome=outcome,
                        records_returned=len(found), elapsed_ms=elapsed, reason=reason)


def trial_design(task: Task, records: list[RawRecord], direct: DirectConnector, n: int) -> tuple[list[RawRecord], list[Attempt]]:
    """ClinicalTrials.gov v2 design + status per NCT: masking, allocation, first-posted date (the registration record's
    date) and, when results are posted, a second record dated by `resultsFirstPostDate`. Two records, never one."""
    out: list[RawRecord] = []
    attempts: list[Attempt] = []
    for r in records:
        if r.kind != "trial-registration" or not r.nct_id:
            out.append(r)
            continue
        args = {"nct_id": r.nct_id}
        t0 = time.monotonic()
        try:
            d, elapsed, _ = direct.call("ctgov.study_design", args)
            attempts.append(Attempt(n=n, transport="direct", tool="ctgov.study_design", query=args, outcome="ok", records_returned=1, elapsed_ms=elapsed))
        except (ToolError, CacheMiss) as e:
            attempts.append(Attempt(n=n, transport="direct", tool="ctgov.study_design", query=args, outcome="error", records_returned=0,
                                    elapsed_ms=int((time.monotonic() - t0) * 1000), reason=str(e)))
            out.append(r)  # keeps the start_date proxy, flagged in date_basis
            continue
        n += 1
        design = {k: d.get(k) for k in ("allocation", "masking", "who_masked", "official_title", "has_results", "overall_status")}
        published, basis = dates.resolve([(d.get("study_first_post_date"), "studyFirstPostDate")])
        if published is None:
            published, basis = r.published, r.date_basis
        out.append(replace(r, published=published, date_basis=basis, payload={**r.payload, "design": design}))
        if d.get("has_results") and d.get("results_first_post_date"):
            rp, rb = dates.resolve([(d["results_first_post_date"], "resultsFirstPostDate")])
            out.append(replace(r, id=r.id + ":results", kind="trial-results", published=rp, date_basis=rb,
                               source_name=f"ClinicalTrials.gov {r.nct_id} results", url=f"https://clinicaltrials.gov/study/{r.nct_id}?tab=results",
                               payload={**r.payload, "design": design, "results_first_post_date": d["results_first_post_date"]}))
    return out, attempts


def _iso(yyyymmdd: str | None) -> str | None:
    s = str(yyyymmdd or "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 and s.isdigit() else None


def label_meta(task: Task, records: list[RawRecord], direct: DirectConnector, n: int) -> tuple[list[RawRecord], Attempt | None]:
    """openFDA per product label: set id, version, `effective_time` (the record's date), application number and the
    warning sections. A record the supplement cannot match stays undated and never becomes Evidence."""
    labels = [r for r in records if r.kind == "label"]
    if not labels:
        return records, None
    args = {"drug_name": task.drug}
    t0 = time.monotonic()
    try:
        found, elapsed, _ = direct.call("openfda.label", args)
        rows, outcome, reason = list((found or {}).get("labels") or []), "ok", None
    except (ToolError, CacheMiss) as e:
        rows, elapsed, outcome, reason = [], int((time.monotonic() - t0) * 1000), "error", str(e)
    by_brand: dict[str, list[dict]] = {}
    for row in rows:
        by_brand.setdefault((row.get("brand_name") or row.get("generic_name") or "").lower(), []).append(row)
    out = []
    for r in records:
        if r.kind != "label":
            out.append(r)
            continue
        brand = (r.payload.get("brand_name") or r.payload.get("generic_name") or "").lower()
        pool = by_brand.get(brand) or []
        boxed = (r.payload.get("boxed_warning") or "")[:80]
        match = next((x for x in pool if (x.get("boxed_warning") or "")[:80] == boxed), pool[0] if pool else None)
        if match is None:
            out.append(r)
            continue
        pool.remove(match)
        published = _iso(match.get("effective_time"))
        basis = "openFDA label effective_time (the current version of this label; earlier versions were not read)" if published else "undated"
        out.append(replace(r, published=published, date_basis=basis, payload={**r.payload, **{k: v for k, v in match.items() if v is not None}}))
    return out, Attempt(n=n, transport="direct", tool="openfda.label", query=args, outcome=outcome if rows or outcome == "error" else "empty",
                        records_returned=len(rows), elapsed_ms=elapsed, reason=reason)


def pick_originator(records: list[RawRecord]) -> RawRecord | None:
    """One label per drug: the NDA/BLA holder's, else a branded product's, else the first dated one."""
    labels = [r for r in records if r.kind == "label" and r.published]
    if not labels:
        return None
    def rank(r: RawRecord) -> tuple[int, int, int, str]:
        app = (r.payload.get("application_number") or "").upper()
        digits = int(re.sub(r"\D", "", app) or 10**9)  # the originator holds the oldest application number
        brand, generic = (r.payload.get("brand_name") or "").lower(), (r.payload.get("generic_name") or "").lower()
        return (0 if app.startswith(("NDA", "BLA")) else 1, digits, 0 if brand and brand != generic else 1, r.published or "")
    return sorted(labels, key=rank)[0]


def drug_safety(task: Task, record: RawRecord, tu: ToolUniverseConnector, direct: DirectConnector, n: int) -> tuple[RawRecord, list[Attempt]]:
    """Open Targets for the chosen label: the black-box toxicity classes and withdrawals (drugWarnings) and the FAERS
    disproportionality signals (adverseEvents, strongest first). ToolUniverse first, the direct GraphQL as fallback;
    both are undated, so they enrich the dated label record and never stand alone."""
    attempts: list[Attempt] = []
    payload = dict(record.payload)
    if not task.drug_chembl_id:
        return record, attempts
    calls = [("OpenTargets_get_drug_warnings_by_chemblId", {"chemblId": task.drug_chembl_id}),
             ("OpenTargets_get_drug_adverse_events_by_chemblId", {"chemblId": task.drug_chembl_id, "page": {"index": 0, "size": 25}})]
    for tool, args in calls:
        data = None
        for transport, conn in (("tooluniverse", tu), ("direct", direct)):
            t0 = time.monotonic()
            try:
                found, elapsed, _ = conn.call(tool, args)
                data = ((found or {}).get("data") or {}).get("drug") or {}
                attempts.append(Attempt(n=n, transport=transport, tool=tool, query=args, outcome="ok", records_returned=1, elapsed_ms=elapsed))
                n += 1
                break
            except (ToolError, CacheMiss) as e:
                attempts.append(Attempt(n=n, transport=transport, tool=tool, query=args, outcome="error", records_returned=0,
                                        elapsed_ms=int((time.monotonic() - t0) * 1000), reason=str(e)))
                n += 1
        if data is None:
            continue
        if tool.endswith("warnings_by_chemblId"):
            rows = data.get("drugWarnings") or []
            payload["toxicity_classes"] = sorted({(w.get("toxicityClass") or "").lower() for w in rows if (w.get("warningType") or "").lower().startswith("black") and w.get("toxicityClass")})
            withdrawn = [w for w in rows if (w.get("warningType") or "").lower().startswith("withdrawn")]
            payload["withdrawn"] = bool(withdrawn)
            payload["withdrawn_where"] = ", ".join(sorted({w.get("country") for w in withdrawn if w.get("country")})) or None
        else:
            ae = data.get("adverseEvents") or {}
            rows = sorted(ae.get("rows") or [], key=lambda x: -(x.get("logLR") or 0))
            payload["signals"] = [{"name": x.get("name"), "reports": int(x.get("count") or 0)} for x in rows[:8] if x.get("name")]
            payload["signals_total"] = ae.get("count")
    return replace(record, payload=payload), attempts
