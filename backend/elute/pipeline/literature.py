"""L4 literature retrieval in the one authoritative order (BACKEND_PLAN v4.4 §9.1, §11):

    retrieve metadata per facet → canonicalize → combine → deduplicate → assign authoritative dates
    → temporal visibility gate → rank → cap → fetch abstract text ONLY for the selected visible records → (extraction)

Abstracts cannot exist before the gate: `CanonRecord` has no abstract field; `AbstractRecord` is built only by
`fetch_abstracts(selected)`. The step's counts are recorded for the trace."""
from __future__ import annotations

import time
from dataclasses import dataclass, field, replace
from typing import Callable

from elute.connectors import enrich
from elute.connectors.base import Attempt, CacheMiss, RawRecord, Task, ToolError
from elute.connectors.direct import DirectConnector
from elute.connectors.records import records_for
from elute.connectors.tooluniverse import ToolUniverseConnector
from elute.models import RetrievalCounts
from elute.pipeline import tools
from elute.pipeline.canonicalize import AbstractRecord, CanonRecord, canonicalize
from elute.pipeline.dedup import dedup
from elute.pipeline.temporal import visible, withheld

MAX_RESULTS_PER_FACET = 5           # selected per facet after the gate (§11.4)
MAX_UNIQUE_PAPERS_AFTER_DEDUP = 20  # selected for extraction in total (§11.4)
MAX_EXTRA_QUERIES = 2               # dynamic-focus follow-ups (§11.2)
ABSTRACT_BATCH = 10

# §11.4 ranking priority by facet; lower is stronger
FACET_PRIORITY = {"efficacy": 1, "exposure": 2, "engagement": 3, "alternative": 4, "criticism": 4, "biomarker": 5, "mechanism": 6, "disease-hypothesis": 8}
DEFAULT_FACET_ORDER = ["efficacy", "exposure", "engagement", "alternative", "criticism", "biomarker", "mechanism", "disease-hypothesis"]
NEGATIVE_FIRST_ORDER = ["exposure", "engagement", "alternative", "criticism", "biomarker", "efficacy", "mechanism", "disease-hypothesis"]


@dataclass
class LiteratureResult:
    selected: list[CanonRecord]
    abstracts: dict[str, AbstractRecord]  # by CanonRecord.key
    counts: RetrievalCounts
    attempts: list[Attempt]
    episodes: list[tools.Episode]
    withheld_count: int
    transport: str | None  # the transport whose records counted for the majority of facets
    selected_tool: str | None
    status: str  # ok | retried | failed


# Title terms that mark a record as actually being about the facet's scientific class (§11.4: relevance and strength
# before citation volume). A broad review that merely mentions the drug does not outrank the measurement.
FACET_TERMS: dict[str, tuple[str, ...]] = {
    "efficacy": ("trial", "randomi", "placebo", "efficacy", "open-label", "open label", "pilot", "phase"),
    "exposure": ("cerebrospinal", "csf", "blood-brain", "blood brain", "brain penetration", "central nervous system", "pharmacokinetic", "pharmacologic", "exposure"),
    "engagement": ("target engagement", "phosphorylation", "kinase activity", "inhibition", "inhibitor"),
    "alternative": ("mao-b", "monoamine oxidase", "withdrawal", "confound", "alternative"),
    "criticism": ("comment", "letter", "limitation", "critique", "reply", "response"),
    "biomarker": ("biomarker", "homovanillic", "synuclein", "cerebrospinal", "csf"),
    "mechanism": ("c-abl", "abl", "kinase", "mechanism", "pathway"),
    "disease-hypothesis": ("parkinson", "neurodegenerat", "dopamin", "synuclein"),
}


def title_relevance(r: CanonRecord, drug: str, disease_terms: list[str]) -> int:
    """0–3: the drug in the title, the disease in the title, a facet term in the title (for the record's primary facet)."""
    t = (r.title or "").lower()
    score = int(drug.lower() in t) + int(any(d.lower() in t for d in disease_terms))
    primary = min(r.facets or ["_"], key=lambda f: FACET_PRIORITY.get(f, 9))
    score += int(any(term in t for term in FACET_TERMS.get(primary, ())))
    return score


def make_rank_key(drug: str, disease_terms: list[str]):
    def rank_key(r: CanonRecord) -> tuple[int, int, int, str]:
        pri = min((FACET_PRIORITY.get(f, 9) for f in r.facets), default=9)
        return (pri, -title_relevance(r, drug, disease_terms), -(r.cited_by_count or 0), r.pmid or r.key)
    return rank_key


def cap(records: list[CanonRecord], drug: str = "", disease_terms: list[str] | None = None) -> list[CanonRecord]:
    """≤ MAX_RESULTS_PER_FACET per primary facet and ≤ MAX_UNIQUE_PAPERS_AFTER_DEDUP in total, in rank order."""
    per_facet: dict[str, int] = {}
    out: list[CanonRecord] = []
    rank_key = make_rank_key(drug, disease_terms or [])
    for r in sorted(records, key=rank_key):
        if len(out) >= MAX_UNIQUE_PAPERS_AFTER_DEDUP:
            break
        primary = min(r.facets or ["_"], key=lambda f: FACET_PRIORITY.get(f, 9))  # a record is charged to the facet it was ranked under
        if per_facet.get(primary, 0) < MAX_RESULTS_PER_FACET:
            out.append(r)
            per_facet[primary] = per_facet.get(primary, 0) + 1
    return out


Progress = Callable[[str], None]  # one line for the Working page while the step runs


def fetch_abstracts(selected: list[CanonRecord], tu: ToolUniverseConnector, direct: DirectConnector, attempts: list[Attempt], n0: int,
                    progress: Progress | None = None) -> dict[str, AbstractRecord]:
    """PubMed_get_article for the selected, visible PMIDs only; direct fallback on error. Never called before the gate."""
    out: dict[str, AbstractRecord] = {}
    by_pmid = {r.pmid: r for r in selected if r.pmid}
    pmids = sorted(by_pmid)
    n = n0
    for i in range(0, len(pmids), ABSTRACT_BATCH):
        batch = pmids[i:i + ABSTRACT_BATCH]
        if progress:
            progress(f"reading abstracts {i + 1}–{min(i + ABSTRACT_BATCH, len(pmids))} of {len(pmids)}")
        args = {"pmid": ",".join(batch)}
        payload = None
        for transport, conn in (("tooluniverse", tu), ("direct", direct)):
            t0 = time.monotonic()
            try:
                payload, elapsed, _ = conn.call("PubMed_get_article", args)
                attempts.append(Attempt(n, transport, "PubMed_get_article", args, "ok", len(batch), elapsed))
                n += 1
                break
            except (ToolError, CacheMiss) as e:
                attempts.append(Attempt(n, transport, "PubMed_get_article", args, "timeout" if getattr(e, "kind", "") == "timeout" else "error", 0,
                                        int((time.monotonic() - t0) * 1000), str(e)))
                n += 1
        if payload is None:
            continue
        for h in (payload.get("data") if isinstance(payload, dict) else payload) or []:
            pmid = str(h.get("pmid") or "")
            if pmid in by_pmid and h.get("abstract"):
                authors = h.get("authors") or []
                out[by_pmid[pmid].key] = AbstractRecord(
                    key=by_pmid[pmid].key, pmid=pmid, title=h.get("title") or by_pmid[pmid].title, abstract=str(h["abstract"]),
                    authors=[a.get("name") if isinstance(a, dict) else str(a) for a in authors],
                    affiliations=[a.get("affiliation") for a in authors if isinstance(a, dict) and a.get("affiliation")],
                    mesh_terms=list(h.get("mesh_terms") or []), publication_types=list(h.get("publication_types") or []))
    return out


def retrieve_literature(base: Task, as_of: str, tu: ToolUniverseConnector, direct: DirectConnector, *, facet_order: list[str] | None = None,
                        selector: tools.Selector | None = None, extra_queries: list[str] | None = None,
                        disabled: Callable[[str], bool] | None = None, progress: Progress | None = None) -> LiteratureResult:
    facet_order = facet_order or DEFAULT_FACET_ORDER
    note = progress or (lambda s: None)
    attempts: list[Attempt] = []
    episodes: list[tools.Episode] = []
    raw: list[tuple[str, RawRecord]] = []
    n = 1
    facets = list(facet_order) + list(extra_queries or [])[:MAX_EXTRA_QUERIES]
    for k, facet in enumerate(facets, 1):
        task = replace(base, facet=facet, id=base.id)
        note(f"searching PubMed, facet {k} of {len(facets)}: {facet}")
        ep = tools.run_task(task, tu, direct, selector=selector, supplements=False, disabled=disabled)
        episodes.append(ep)
        for a in ep.attempts:
            attempts.append(replace(a, n=n))
            n += 1
        raw.extend((facet, r) for r in ep.records)
        how = f"{len(ep.records)} record(s)" + (f" via {ep.transport}" if ep.transport else "") + (", after a retry" if len(ep.attempts) > 1 else "") if ep.status == "ok" else "nothing usable after every attempt"
        note(f"{facet}: {how}")
    retrieved = [canonicalize(r, facet) for facet, r in raw]
    combined = dedup(retrieved)
    note(f"{len(retrieved)} records → {len(combined)} after deduplication; dating them via Europe PMC")
    # authoritative dates on the deduplicated set: one batched supplement (§9.2)
    dated_raw, a = enrich.literature_dates(base, [_as_raw(c) for c in combined], direct, n)
    if a:
        attempts.append(a)
        n += 1
    dates = {r.id: (r.published, r.date_basis, r.payload.get("cited_by_count")) for r in dated_raw}
    for c in combined:
        if c.raw_ids and c.raw_ids[0] in dates:
            c.published, c.date_basis, cbc = dates[c.raw_ids[0]]
            if c.cited_by_count is None and isinstance(cbc, int):
                c.cited_by_count = cbc
    vis = visible(combined, as_of)
    hidden = withheld(combined, as_of)
    note(f"{len(vis)} visible on {as_of}; {len(hidden)} later record(s) withheld before anything is read")
    selected = cap(vis, base.drug, [base.disease] + list(base.disease_aliases))
    note(f"{len(selected)} selected for reading, by facet priority and title relevance")
    abstracts = fetch_abstracts(selected, tu, direct, attempts, n, progress) if selected else {}
    counts = RetrievalCounts(results_retrieved=len(retrieved), results_after_dedup=len(combined), results_after_temporal_filter=len(vis),
                             records_withheld=len(hidden), results_selected_for_extraction=len(selected))
    ok = [e for e in episodes if e.status == "ok"]
    transports = [e.transport for e in ok if e.transport]
    transport = max(set(transports), key=transports.count) if transports else None
    status = "ok" if ok and all(e.status == "ok" for e in episodes) else ("retried" if ok else "failed")
    if ok and any(len(e.attempts) > 1 for e in ok):
        status = "retried"
    return LiteratureResult(selected=selected, abstracts=abstracts, counts=counts, attempts=attempts, episodes=episodes, withheld_count=len(hidden),
                            transport=transport, selected_tool=(ok[0].selected_tool if ok else None), status=status)


def _as_raw(c: CanonRecord) -> RawRecord:
    """A minimal RawRecord view of a CanonRecord for the shared date supplement (no abstract, by construction)."""
    return RawRecord(id=c.raw_ids[0] if c.raw_ids else c.key, task_id="L4", kind="article", transport=c.transport, tool=c.tool, source_name=c.source_name,
                     url=c.url, published=c.published, date_basis=c.date_basis, text=c.text, payload={"pub_date": c.payload.get("pub_date")}, pmid=c.pmid, nct_id=c.nct_id)
