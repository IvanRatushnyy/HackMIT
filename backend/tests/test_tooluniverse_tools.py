"""One test per verified ToolUniverse tool, on recorded nilotinib / Parkinson's payloads (stop conditions 21–23, 27).
Every assertion here is a fact the curated fixture or the backtest depends on."""
from __future__ import annotations

import pytest

from elute.connectors.records import records_for
from elute.connectors.tooluniverse import TOOL_NAMES
from elute.pipeline.tools import TASK_TOOLS, run_task
from tests.conftest import task

NOV_2017 = "2017-11-20"
JUL_2016 = "2016-07-11"


def test_every_task_tool_is_a_verified_name():
    for names in TASK_TOOLS.values():
        assert set(names) <= set(TOOL_NAMES)
    assert len(TOOL_NAMES) >= 3


# ---- L1 resolve ----------------------------------------------------------------

def test_resolve_drug_to_chembl(tu, direct):
    ep = run_task(task("resolve", "L1", drug_chembl_id=None, target_symbol=None), tu, direct)
    assert ep.status == "ok" and ep.transport == "tooluniverse"
    assert ep.selected_tool == "OpenTargets_get_drug_chembId_by_generic_name"
    assert ep.records[0].payload["id"] == "CHEMBL255863"


def test_resolve_disease_to_mondo(tu, direct):
    ep = run_task(task("resolve", "L1", target_symbol=None), tu, direct)
    assert ep.selected_tool == "OpenTargets_get_disease_id_description_by_name"
    assert ep.records[0].payload["id"] == "MONDO_0005180" and ep.records[0].payload["name"] == "Parkinson disease"


def test_resolve_target_symbol(tu, direct):
    ep = run_task(task("resolve", "L1", drug_chembl_id=None), tu, direct)
    assert ep.records[0].payload["id"] == "ENSG00000097007"


# ---- L2 biology ----------------------------------------------------------------

def test_mechanism_names_abl1_with_a_dated_label(tu, direct):
    ep = run_task(task("biology", "L2", target_ensembl_id=None), tu, direct)
    assert ep.selected_tool == "OpenTargets_get_drug_mechanisms_of_action_by_chemblId"
    rows = [r for r in ep.records if r.kind == "mechanism"]
    assert any("ABL1" in r.text and r.payload["actionType"] == "INHIBITOR" for r in rows)
    r = rows[0]
    assert r.published == "2010-12-31" and "FDA label URL year" in r.date_basis  # the 2010 Tasigna label, resolved late
    assert r.url.startswith("https://www.accessdata.fda.gov/")


def test_association_rows_state_their_datasource_and_get_dated(tu, direct):
    ep = run_task(task("biology", "L2"), tu, direct)
    assert ep.selected_tool == "OpenTargets_get_evidence_by_datasource"
    assoc = [r for r in ep.records if r.kind == "association"]
    assert assoc and all(r.source_name.startswith("Open Targets · ") for r in assoc)
    dated = [r for r in assoc if r.published]
    assert dated and all(r.pmid for r in dated)
    assert all(r.published is None for r in assoc if not r.pmid)  # no PMID → undated → never Evidence
    assert [a.tool for a in ep.attempts] == ["OpenTargets_get_evidence_by_datasource", "europepmc.dates"]


# ---- L3 trials ------------------------------------------------------------------

def test_trials_registration_and_results_are_separate_dated_records(tu, direct):
    ep = run_task(task("trials", "L3"), tu, direct)
    assert ep.selected_tool == "ClinicalTrials_search_studies" and ep.transport == "tooluniverse"
    by = {(r.nct_id, r.kind): r for r in ep.records}
    nilo_pd = by[("NCT03205488", "trial-registration")]
    assert nilo_pd.payload["enrollment"] == 76 and nilo_pd.payload["design"]["masking"] == "TRIPLE"
    assert nilo_pd.published == "2017-07-02" and "studyFirstPostDate" in nilo_pd.date_basis
    assert by[("NCT03205488", "trial-results")].published == "2020-07-22"
    georgetown = by[("NCT02954978", "trial-registration")]
    assert georgetown.published == "2016-11-04" and georgetown.payload["design"]["masking"] == "QUADRUPLE"
    pilot = by[("NCT02281474", "trial-registration")]
    assert pilot.payload["enrollment"] == 12 and pilot.payload["design"]["masking"] == "NONE"
    assert ("NCT02281474", "trial-results") not in by
    # the backtest: at Nov 2017 both phase-2 registrations are visible, no results are
    visible = [r for r in ep.records if r.published and r.published <= NOV_2017]
    assert {r.nct_id for r in visible if r.kind == "trial-registration"} == {"NCT02954978", "NCT03205488", "NCT02281474"}
    assert not [r for r in visible if r.kind == "trial-results"]
    assert [a.transport for a in ep.attempts] == ["tooluniverse", "direct", "direct", "direct"]


# ---- L4 literature ---------------------------------------------------------------

@pytest.mark.parametrize("pmid,date", [
    ("27434297", "2016-07-01"),  # Pagan 2016, open-label n = 12: Europe PMC 2016-07-01 < PubMed 2016-07-11; earliest day-level wins
    ("25025064", "2014-06-15"),  # Reinwald 2014, CSF/plasma: PubMed says only "2014"; Europe PMC gives the day
    ("28035939", "2017-01-01"),  # the MAO-B withdrawal commentary: visible at Nov 2017
])
def test_literature_dates_are_day_level_and_visible_when_the_backtest_needs_them(tu, direct, pmid, date):
    from elute.pipeline.literature import retrieve_literature
    res = retrieve_literature(task("literature", "L4"), NOV_2017, tu, direct)
    rec = next(r for r in res.selected if r.pmid == pmid)
    assert rec.published == date, rec.date_basis
    assert rec.published <= JUL_2016 if pmid == "27434297" else rec.published <= NOV_2017


def test_literature_search_records_carry_no_abstract_and_the_date_supplement_is_on_the_trace(tu, direct):
    """§9.1: the search is metadata-only; abstracts exist only after the gate and the cap (see test_literature.py)."""
    ep = run_task(task("literature", "L4", facet="mechanism"), tu, direct)
    assert ep.selected_tool == "PubMed_search_articles" and ep.transport == "tooluniverse"
    assert ep.attempts[0].query["include_abstract"] is False
    assert not any(r.payload.get("abstract") for r in ep.records)
    assert all(a.tool != "europepmc.dates" for a in ep.attempts)  # the date supplement runs once, on the deduplicated set (literature.py)


# ---- parity: the direct fallback yields the same record schema ----------------------

@pytest.mark.parametrize("tool,args,kind", [
    ("OpenTargets_get_drug_mechanisms_of_action_by_chemblId", {"chemblId": "CHEMBL255863"}, "mechanism"),
    ("OpenTargets_get_evidence_by_datasource", {"efoId": "MONDO_0005180", "ensemblId": "ENSG00000097007", "size": 50}, "association"),
    ("ClinicalTrials_search_studies", {"query_cond": "(Parkinson disease)", "query_intr": "(nilotinib)", "page_size": 100}, "trial-registration"),
])
def test_direct_fallback_produces_the_same_record_shape(tu, direct, tool, args, kind):
    t = task("biology" if kind != "trial-registration" else "trials", "Lx")
    a = records_for(tool, t, "tooluniverse", tu.call(tool, args)[0])
    b = records_for(tool, t, "direct", direct.call(tool, args)[0])
    assert a and b and {r.kind for r in a} == {r.kind for r in b} == {kind}
    key = (lambda r: r.nct_id) if kind == "trial-registration" else (lambda r: r.text)
    assert {key(r) for r in a} & {key(r) for r in b}
    for x, y in zip(a, b):
        assert set(vars(x)) == set(vars(y))
