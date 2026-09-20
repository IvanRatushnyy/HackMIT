"""L2/L3/L4 records → Evidence with provenance (BACKEND_PLAN v4.4 §7, §13), on cassettes; the direct fallback yields
the same Evidence ids (stop condition 29)."""
from __future__ import annotations

from elute.models import Resolved
from elute.pipeline.canonicalize import canonicalize
from elute.pipeline.literature import retrieve_literature
from elute.pipeline.normalize import evidence_from_article, evidence_from_association, evidence_from_mechanism, evidence_from_trial
from elute.pipeline.tools import run_task
from tests.conftest import task
from tests.constants import PRE_TRIAL_SNAPSHOT

RES = Resolved(drug_chembl_id="CHEMBL255863", disease_efo_id="MONDO_0005180", target_ensembl_id="ENSG00000097007", target_symbol="ABL1", disease_name="Parkinson disease", drug_name="nilotinib")


def test_trials_become_two_dated_evidence_per_completed_trial_with_provenance(tu, direct):
    ep = run_task(task("trials", "L3"), tu, direct)
    evs = [e for e in (evidence_from_trial(canonicalize(r), ep.attempts) for r in ep.records) if e]
    by = {e.source_record_id: e for e in evs}
    reg, res = by["NCT03205488|registration"], by["NCT03205488|results"]
    assert reg.evidence_kind == "registration" and reg.publication_date == "2017-07-02" and reg.sample_size == 76 and reg.blinded is True and reg.controlled is True
    assert res.evidence_kind == "results" and res.publication_date == "2020-07-22" and res.outcome == "na" and res.relevance == []
    assert reg.source_provider == "clinicaltrials_gov" and reg.transport == "tooluniverse" and reg.tool_name == "ClinicalTrials_search_studies"
    assert [s.tool for s in reg.supplements] == ["ctgov.study_design"] * len(reg.supplements) and reg.supplements
    assert by["NCT02954978|registration"].sample_size == 75 and by["NCT02954978|results"].publication_date == "2026-06-12"
    assert reg.id != res.id


def test_mechanism_row_supports_c_mechanism_and_is_dated_by_the_label(tu, direct):
    ep = run_task(task("biology", "L2", target_ensembl_id=None), tu, direct)
    evs = [e for e in (evidence_from_mechanism(canonicalize(r), RES, ep.attempts) for r in ep.records) if e]
    abl = next(e for e in evs if any(r.claim_id == "C_MECHANISM" for r in e.relevance))
    assert abl.study_type == "label" and abl.publication_date == "2010-12-31" and abl.date_confidence == "year" and abl.source_provider == "open_targets"


def test_association_rows_need_a_pmid_and_never_reach_established_alone(tu, direct):
    ep = run_task(task("biology", "L2"), tu, direct)
    evs = [e for e in (evidence_from_association(canonicalize(r), RES, ep.attempts) for r in ep.records) if e]
    assert evs and all(e.relevance[0].claim_id == "C_DISEASE_RELEVANCE" and e.independence_group == "unknown" for e in evs)
    from elute.engine.labels import derive_status
    assert derive_status("C_DISEASE_RELEVANCE", evs).status == "single-source"  # unknown groups never count as independent


def test_articles_without_extraction_carry_no_relevance_and_the_same_id_on_both_transports(tu, direct):
    res = retrieve_literature(task("literature", "L4"), PRE_TRIAL_SNAPSHOT, tu, direct)
    pagan = next(r for r in res.selected if r.pmid == "27434297")
    e = evidence_from_article(pagan, res.abstracts.get(pagan.key), None, res.attempts)
    assert e and e.relevance == [] and e.study_type == "unknown" and e.source_provider == "pubmed" and e.publication_date <= PRE_TRIAL_SNAPSHOT
    assert e.tool_name == "PubMed_search_articles" and e.transport == "tooluniverse"
    twin = evidence_from_article(canonicalize(pagan.__class__ and pagan and next(iter([pagan])) and _direct_twin(pagan)), None, None, [])
    assert twin and twin.id == e.id  # id depends on provider|record|kind|date, never on transport


def _direct_twin(c):
    from elute.connectors.base import RawRecord
    return RawRecord(id="x", task_id="L4", kind="article", transport="direct", tool="PubMed_search_articles", source_name=c.source_name, url=c.url,
                     published=c.published, date_basis=c.date_basis, text=c.text, payload=dict(c.payload), pmid=c.pmid)
