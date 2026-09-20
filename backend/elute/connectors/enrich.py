"""Recorded supplements, applied to records whichever transport delivered them.
Each supplement is one more Attempt on the step (transport = direct), so the trace shows it."""
from __future__ import annotations

import time
from dataclasses import replace

from elute.connectors import dates
from elute.connectors.base import Attempt, CacheMiss, RawRecord, Task, ToolError
from elute.connectors.direct import DirectConnector


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
