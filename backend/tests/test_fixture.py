"""M1: the curated nilotinib bundle validates, its ids are stable, and its citations resolve."""
from __future__ import annotations

from elute.fixtures import aliases_for, load_bundle
from elute.ids import CLAIM_IDS


def test_bundle_validates_and_ids_are_content_derived():
    b = load_bundle()
    assert b.drug == "nilotinib" and len(b.evidence) >= 15
    ids = {e.id for e in b.evidence}
    assert all(i.startswith("EV_") and len(i) == 15 for i in ids)
    assert len(ids) == len(b.evidence)
    # every relevance names a fixed claim; every cite resolves to an evidence id or a claim id
    for e in b.evidence:
        for r in e.relevance:
            assert r.claim_id in CLAIM_IDS
    for s in b.synthesis.values():
        for item in s.strongest_case_for + s.strongest_case_against:
            for c in item.cites:
                assert c in ids or c in CLAIM_IDS, c


def test_two_trials_are_two_registrations_and_two_results():
    b = load_bundle()
    by = {(e.source_record_id): e for e in b.evidence if e.source_provider == "clinicaltrials_gov"}
    assert by["NCT03205488|registration"].publication_date == "2017-07-02" and by["NCT03205488|registration"].sample_size == 76
    assert by["NCT02954978|registration"].publication_date == "2016-11-04" and by["NCT02954978|registration"].sample_size == 75
    assert by["NCT03205488|results"].publication_date == "2020-07-22"
    assert by["NCT02954978|results"].publication_date == "2026-06-12"
    for e in by.values():
        assert e.relevance == []  # registry records never link to claims; the primary publications do


def test_reasoning_covers_all_ten_steps_and_synthesis_the_three_snapshots():
    b = load_bundle()
    assert set(b.reasoning) == {f"L{i}" for i in range(1, 11)}
    assert set(b.synthesis) == {"2016-07-11", "2017-11-20", "2026-09-20"}
    assert aliases_for()["simuni-2021"] == next(e.id for e in b.evidence if e.source_record_id == "pmid:33315105")
