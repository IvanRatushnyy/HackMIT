"""L4 in the one authoritative order (BACKEND_PLAN v4.4 §9.1, §11.3–11.4), on recorded cassettes."""
from __future__ import annotations

from elute.connectors.base import RawRecord
from elute.pipeline.canonicalize import CanonRecord, canonicalize
from elute.pipeline.dedup import dedup
from elute.pipeline.literature import MAX_RESULTS_PER_FACET, MAX_UNIQUE_PAPERS_AFTER_DEDUP, cap, retrieve_literature
from tests.conftest import task
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT


def raw(pmid: str, title: str = "T", facet_text: str = "", abstract: str | None = "an abstract", published: str | None = "2015-01-01") -> RawRecord:
    return RawRecord(id=f"L4:PubMed_search_articles:{pmid}", task_id="L4", kind="article", transport="tooluniverse", tool="PubMed_search_articles",
                     source_name="x", url="u", published=published, date_basis="PubMed pub_date", text=title, pmid=pmid,
                     payload={"pmid": pmid, "title": title, "abstract": abstract, "pub_year": "2015", "journal": "J"})


def test_canonical_records_cannot_carry_abstracts():
    c = canonicalize(raw("1", abstract="SECRET"), "efficacy")
    assert "abstract" not in c.payload and "SECRET" not in c.text and not hasattr(c, "abstract")
    assert "abstract" not in CanonRecord.__dataclass_fields__


def test_dedup_across_facets_keeps_one_publication_with_the_union_of_facets():
    rs = [canonicalize(raw("27434297"), f) for f in ("efficacy", "criticism", "biomarker")]
    out = dedup(rs)
    assert len(out) == 1 and out[0].facets == ["efficacy", "criticism", "biomarker"] and out[0].raw_ids == ["L4:PubMed_search_articles:27434297"]


def test_dedup_key_priority_pmid_pmcid_doi_title():
    a = raw("", title="Same Title"); a.pmid = None; a.payload.update(pmid=None, doi="10.1/X", pmcid=None)
    b = raw("", title="Same Title"); b.pmid = None; b.payload.update(pmid=None, doi="https://doi.org/10.1/x", pmcid=None)
    assert dedup([canonicalize(a), canonicalize(b)])[0].key == "doi:10.1/x" and len(dedup([canonicalize(a), canonicalize(b)])) == 1
    c = raw("", title="Same Title!"); c.pmid = None; c.payload.update(pmid=None, doi=None, pmcid=None)
    assert canonicalize(c).key == "title:same title|2015"


def test_cap_bounds_per_facet_and_total():
    rs = [canonicalize(raw(str(i)), "efficacy") for i in range(30)] + [canonicalize(raw(str(100 + i)), "exposure") for i in range(30)]
    out = cap(rs)
    assert len(out) <= MAX_UNIQUE_PAPERS_AFTER_DEDUP
    assert sum(1 for r in out if "efficacy" in r.facets) <= MAX_RESULTS_PER_FACET
    assert sum(1 for r in out if "exposure" in r.facets) <= MAX_RESULTS_PER_FACET


def test_full_order_on_cassettes_no_abstract_before_the_gate_and_counts_audited(tu, direct):
    for as_of in (EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT, CURRENT_GOLDEN_SNAPSHOT):
        res = retrieve_literature(task("literature", "L4"), as_of, tu, direct)
        c = res.counts
        assert c.results_retrieved >= c.results_after_dedup >= c.results_after_temporal_filter >= c.results_selected_for_extraction
        assert c.records_withheld == c.results_after_dedup - c.results_after_temporal_filter
        assert c.results_selected_for_extraction <= MAX_UNIQUE_PAPERS_AFTER_DEDUP
        assert all(r.published and r.published <= as_of for r in res.selected)
        assert set(res.abstracts) <= {r.key for r in res.selected}  # abstracts only for selected visible records
        assert all(a.abstract for a in res.abstracts.values())
        assert res.abstracts  # cassette drift guard: the current selection must still hit recorded PubMed_get_article batches
        # the search attempts never asked for abstracts; the only abstract calls are PubMed_get_article after the cap
        for a in res.attempts:
            if a.tool == "PubMed_search_articles":
                assert a.query.get("include_abstract") is False
        get_calls = [a for a in res.attempts if a.tool == "PubMed_get_article"]
        assert get_calls and all(a.n > max(x.n for x in res.attempts if x.tool == "PubMed_search_articles") for a in get_calls)


def test_backtest_papers_are_selected_when_visible(tu, direct):
    res = retrieve_literature(task("literature", "L4"), PRE_TRIAL_SNAPSHOT, tu, direct)
    pmids = {r.pmid for r in res.selected}
    assert {"27434297", "25025064", "28035939"} <= pmids  # Pagan 2016, Reinwald 2014, the MAO-B commentary
    assert "33315105" not in {r.pmid for r in res.selected}  # Simuni 2021 is not visible in 2017


def test_natural_path_b_is_recorded_not_manufactured(tu, direct):
    res = retrieve_literature(task("literature", "L4"), CURRENT_GOLDEN_SNAPSHOT, tu, direct)
    alt = next(e for e in res.episodes if any(a.query.get("query", "").find("MAO-B") >= 0 for a in e.attempts))
    outcomes = [a.outcome for a in alt.attempts]
    assert outcomes[0] in ("empty", "insufficient", "ok")
    if outcomes[0] != "ok":
        assert outcomes[1] == "ok" and alt.attempts[1].transport == "tooluniverse"  # reformulated on the same transport
