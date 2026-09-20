"""Claim applicability at normalization (§4 defence in depth): C_CLINICAL is a human-outcome claim, so a positive link to
it survives extraction only from a human study that reports patient outcomes. Nothing here touches the status rules."""
from __future__ import annotations

from elute.engine.labels import derive_status
from elute.models import Extraction, Relevance
from elute.pipeline.canonicalize import CanonRecord
from elute.pipeline.normalize import evidence_from_article, positive_link_applies


def record(pmid: str, authors: list[str], affiliation: str, published: str, title: str = "t") -> CanonRecord:
    return CanonRecord(key=f"pmid:{pmid}", kind="article", transport="tooluniverse", tool="PubMed_search_articles", source_name="PubMed",
                       url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", published=published, date_basis="pubmed pub_date", pmid=pmid, title=title,
                       year=published[:4], authors=authors, affiliation=affiliation)


def link(claim_id: str, direction: str) -> Relevance:
    return Relevance(claim_id=claim_id, direction=direction, statement="s", verbatim_sentence="quoted")


MOUSE = Extraction(study_type="preclinical", population="animal", caveats=["animal-model"],
                   relevance=[link("C_CLINICAL", "qualifies"), link("C_DOWNSTREAM", "qualifies")])
PAGAN = Extraction(study_type="open-label", controlled=False, blinded=False, placebo=False, population="human", sample_size=12,
                   caveats=["open-label", "no-placebo", "small-n", "single-site"], relevance=[link("C_CLINICAL", "supports")])
COMMENTARY = Extraction(study_type="commentary", population="human", relevance=[link("C_CLINICAL", "qualifies")])
NILO_PD = Extraction(study_type="rct", controlled=True, blinded=True, placebo=True, population="human", sample_size=76, outcome="negative",
                     relevance=[link("C_CLINICAL", "refutes")])


def test_animal_evidence_cannot_positively_support_c_clinical():
    e = evidence_from_article(record("24600352", ["Karuppagounder SS"], "Johns Hopkins", "2014-02-20"), None, MOUSE, [])
    assert not [r for r in e.relevance if r.claim_id == "C_CLINICAL"]
    assert e.population == "animal" and "animal-model" in e.caveats  # the record is kept, only the link is dropped
    assert not positive_link_applies("C_CLINICAL", "supports", "preclinical", "cell-line")
    assert not positive_link_applies("C_CLINICAL", "qualifies", "preclinical", "animal")


def test_the_same_animal_evidence_still_qualifies_c_downstream():
    e = evidence_from_article(record("24600352", ["Karuppagounder SS"], "Johns Hopkins", "2014-02-20"), None, MOUSE, [])
    assert [(r.claim_id, r.direction) for r in e.relevance] == [("C_DOWNSTREAM", "qualifies")]
    assert derive_status("C_DOWNSTREAM", [e]).status == "single-source"
    assert positive_link_applies("C_DOWNSTREAM", "qualifies", "preclinical", "animal")


def test_one_open_label_human_study_yields_single_source():
    pagan = evidence_from_article(record("27434297", ["Pagan F"], "Georgetown", "2016-07-01"), None, PAGAN, [])
    mice = [evidence_from_article(record("24600352", ["Karuppagounder SS"], "Johns Hopkins", "2014-02-20"), None, MOUSE, []),
            evidence_from_article(record("23666528", ["Hebron ML"], "Georgetown", "2013-05-10"), None, MOUSE, [])]
    assert [(r.claim_id, r.direction) for r in pagan.relevance] == [("C_CLINICAL", "supports")]
    r = derive_status("C_CLINICAL", [pagan, *mice])
    assert r.status == "single-source" and set(r.caveats) >= {"open-label", "no-placebo", "small-n"}


def test_skeptical_commentary_is_not_a_second_independent_clinical_study():
    pagan = evidence_from_article(record("27434297", ["Pagan F"], "Georgetown", "2016-07-01"), None, PAGAN, [])
    sherer = evidence_from_article(record("27434298", ["Sherer TB"], "Michael J. Fox Foundation", "2016-07-01"), None, COMMENTARY, [])
    assert not [r for r in sherer.relevance if r.claim_id == "C_CLINICAL"]
    assert derive_status("C_CLINICAL", [pagan, sherer]).status == "single-source"
    # a commentary that argues against the claim keeps its contradicts link: criticism is not silenced, only not counted as support
    against = evidence_from_article(record("27434298", ["Sherer TB"], "Michael J. Fox Foundation", "2016-07-01"), None,
                                    Extraction(study_type="commentary", population="human", relevance=[link("C_CLINICAL", "contradicts")]), [])
    assert [(r.claim_id, r.direction) for r in against.relevance] == [("C_CLINICAL", "contradicts")]
    assert derive_status("C_CLINICAL", [pagan, against]).status == "contested"


def test_controlled_blinded_negative_human_trial_still_refutes():
    pagan = evidence_from_article(record("27434297", ["Pagan F"], "Georgetown", "2016-07-01"), None, PAGAN, [])
    simuni = evidence_from_article(record("33315105", ["Simuni T"], "Northwestern", "2020-12-14"), None, NILO_PD, [])
    assert [(r.claim_id, r.direction) for r in simuni.relevance] == [("C_CLINICAL", "refutes")]
    assert derive_status("C_CLINICAL", [pagan, simuni]).status == "refuted"
    # the refutes gate is unchanged: an uncontrolled negative still lands as contradicts
    weak = evidence_from_article(record("1", ["A B"], "X", "2020-01-01"), None,
                                 Extraction(study_type="open-label", controlled=False, population="human", outcome="negative", relevance=[link("C_CLINICAL", "refutes")]), [])
    assert weak.relevance[0].direction == "contradicts"


def test_current_snapshot_behaviour_on_the_curated_bundle_is_unchanged():
    from elute.fixtures import load_bundle
    from elute.pipeline.temporal import visible
    from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT
    b = load_bundle()
    assert derive_status("C_CLINICAL", visible(b.evidence, CURRENT_GOLDEN_SNAPSHOT)).status == "refuted"
    assert derive_status("C_CLINICAL", visible(b.evidence, EARLY_SNAPSHOT)).status == "single-source"
    # every positive C_CLINICAL link in the curated bundle already satisfies the applicability rule
    for e in b.evidence:
        for r in e.relevance:
            assert positive_link_applies(r.claim_id, r.direction, e.study_type, e.population), (e.id, r.claim_id, r.direction, e.study_type, e.population)
