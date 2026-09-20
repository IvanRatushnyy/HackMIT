"""L2 safety: the FDA label as dated evidence on C_SAFETY, the Safety block and the fifth prerequisite the adapter
derives from it, on cassettes (nilotinib) and on the curated bundle (the 2007 Tasigna label)."""
from __future__ import annotations

from elute.api.adapt import adapt, label_at, safety_block
from elute.connectors.base import RawRecord
from elute.connectors.records import records_for
from elute.connectors import enrich
from elute.fixtures import load_bundle
from elute.pipeline.canonicalize import canonicalize
from elute.pipeline.label import parse_boxed, parse_indication, parse_sections, sentence_case, system_for
from elute.pipeline.normalize import evidence_from_label
from elute.pipeline.orchestrator import run_fixture
from elute.pipeline.orchestrator_live import LiveRun
from elute.pipeline.tools import run_task
from tests.conftest import task
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT

BOXED = ("WARNING: QT PROLONGATION and SUDDEN DEATHS Tasigna prolongs the QT interval. Prior to Tasigna administration and periodically, monitor for "
         "hypokalemia or hypomagnesemia and correct deficiencies [see Warnings and Precautions (5.2)] . Sudden deaths have been reported in patients receiving Tasigna.")
HIGHLIGHTS = ("5 WARNINGS AND PRECAUTIONS Myelosuppression: Monitor complete blood count (CBC) during therapy. ( 5.1 ) Cardiac and Arterial Vascular Occlusive "
              "Events: Evaluate cardiovascular status. ( 5.4 ) Hepatotoxicity: Monitor hepatic function tests monthly. ( 5.6 ) 5.1 Myelosuppression Treatment with Tasigna can cause anemia.")


# ---- parsing: only what the label says ------------------------------------------------------------

def test_boxed_warning_title_and_first_sentence():
    assert parse_boxed(BOXED) == ("QT prolongation and sudden deaths", "Tasigna prolongs the QT interval")
    assert parse_boxed("WARNING: LACTIC ACIDOSIS Postmarketing cases of metformin-associated lactic acidosis have resulted in death.") == (
        "Lactic acidosis", "Postmarketing cases of metformin-associated lactic acidosis have resulted in death")
    assert parse_boxed(None) == (None, None)
    assert sentence_case("RISK OF THYROID C-CELL TUMORS") == "Risk of thyroid c-cell tumors"


def test_acronyms_keep_their_case_only_when_written_as_acronyms():
    assert sentence_case("Fractures in all patients") == "Fractures in all patients"  # never "ALL" (acute lymphoblastic leukemia)
    assert sentence_case("Use in MEN 2 and in men") == "Use in MEN 2 and in men"
    assert sentence_case("Monitor ECGs and QTc") == "Monitor ECGs and QTc"


def test_boxed_reason_starts_exactly_where_the_title_stopped():
    # punctuation inside the title and a trailing joiner are consumed by the title, never carried into the reason
    assert parse_boxed("WARNING: SERIOUS INFECTIONS and MALIGNANCY. Increased risk of serious infections leading to hospitalization.") == (
        "Serious infections and malignancy", "Increased risk of serious infections leading to hospitalization")
    assert parse_boxed("WARNING: RISK OF Serious infections have occurred. Monitor closely.") == ("Risk", "Serious infections have occurred")


def test_sections_are_read_from_the_highlights_in_label_order_and_a_none_section_is_empty():
    got = parse_sections(HIGHLIGHTS)
    assert [h for h, _ in got] == ["Myelosuppression", "Cardiac and Arterial Vascular Occlusive Events", "Hepatotoxicity"]
    assert got[0][1] == "Monitor complete blood count (CBC) during therapy"
    assert [system_for(h) for h, _ in got] == ["blood", "heart and vessels", "liver"]
    assert parse_sections("WARNINGS None") == [] and parse_sections(None) == []


def test_indication_is_what_the_label_was_written_for():
    assert parse_indication("1 INDICATIONS AND USAGE BYETTA is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus. Limitations of Use") == (
        "as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus")
    assert parse_indication(None) is None


# ---- the tool, its supplement and the direct twin ------------------------------------------------------

def test_label_task_returns_dated_rows_via_tooluniverse_with_the_openfda_supplement(tu, direct):
    ep = run_task(task("safety", "L2"), tu, direct)
    assert ep.status == "ok" and ep.transport == "tooluniverse" and ep.selected_tool == "FDA_get_boxed_warning_info_by_drug_name"
    assert [(a.transport, a.tool) for a in ep.attempts] == [("tooluniverse", "FDA_get_boxed_warning_info_by_drug_name"), ("direct", "openfda.label")]
    dated = [r for r in ep.records if r.published]
    assert dated and all("effective_time" in r.date_basis for r in dated)
    chosen = enrich.pick_originator(ep.records)
    assert chosen.payload["brand_name"] == "Tasigna" and chosen.payload["application_number"] == "NDA022068" and chosen.published == "2025-12-16"


def test_label_evidence_argues_against_c_safety_and_carries_the_structured_facts(tu, direct):
    ep = run_task(task("safety", "L2"), tu, direct)
    chosen, extra = enrich.drug_safety(task("safety", "L2"), enrich.pick_originator(ep.records), tu, direct, 3)
    e = evidence_from_label(canonicalize(chosen), "nilotinib", "Parkinson disease", ep.attempts + extra)
    assert e.source_provider == "openfda" and e.evidence_kind == "label" and e.study_type == "label" and e.publication_date == "2025-12-16"
    assert e.source_url.startswith("https://dailymed.nlm.nih.gov/") and e.tool_name == "FDA_get_boxed_warning_info_by_drug_name"
    assert [(r.claim_id, r.direction) for r in e.relevance] == [("C_SAFETY", "contradicts")]
    s = e.safety
    assert s.boxed_title == "QT prolongation and sudden deaths" and s.brand == "Tasigna" and s.set_id
    assert {"Myelosuppression", "Hepatotoxicity", "Hemorrhage"} <= {x.heading for x in s.sections}
    assert "cardiotoxicity" in s.toxicity_classes and not s.withdrawn
    assert s.signals and s.signals[0].name == "electrocardiogram qt prolonged" and s.signals_total == 23
    assert {x.tool for x in e.supplements} == {"openfda.label", "OpenTargets_get_drug_warnings_by_chemblId", "OpenTargets_get_drug_adverse_events_by_chemblId"}


def test_direct_fallback_yields_the_same_label_records_and_the_same_evidence_id(tu, direct):
    t = task("safety", "L2")
    args = {"drug_name": "nilotinib", "limit": 25}
    a = records_for("FDA_get_boxed_warning_info_by_drug_name", t, "tooluniverse", tu.call("FDA_get_boxed_warning_info_by_drug_name", args)[0])
    b = records_for("FDA_get_boxed_warning_info_by_drug_name", t, "direct", direct.call("FDA_get_boxed_warning_info_by_drug_name", args)[0])
    assert {r.payload["brand_name"] for r in a} == {r.payload["brand_name"] for r in b} and {r.kind for r in a} == {"label"}
    ra, _ = enrich.label_meta(t, a, direct, 2)
    rb, _ = enrich.label_meta(t, b, direct, 2)
    ea = evidence_from_label(canonicalize(enrich.pick_originator(ra)), "nilotinib", "Parkinson disease", [])
    eb = evidence_from_label(canonicalize(enrich.pick_originator(rb)), "nilotinib", "Parkinson disease", [])
    assert ea.id == eb.id and ea.transport == "tooluniverse" and eb.transport == "direct"


def test_an_undated_label_row_never_becomes_evidence():
    r = RawRecord(id="x", task_id="L2", kind="label", transport="direct", tool="FDA_get_boxed_warning_info_by_drug_name", source_name="FDA label (x)", url="u",
                  published=None, date_basis="undated", text="x", payload={"brand_name": "X", "generic_name": "x", "boxed_warning": "WARNING: SOMETHING"})
    assert evidence_from_label(canonicalize(r), "x", "y", []) is None


# ---- the live run and the adapter --------------------------------------------------------------------------

def test_live_run_reads_the_label_in_l2_and_the_adapter_emits_the_safety_block_at_today(tu, direct):
    notes = []
    ap = LiveRun(tu=tu, direct=direct, progress=lambda s, n: notes.append((s, n))).run("nilotinib", "Parkinson disease", CURRENT_GOLDEN_SNAPSHOT)
    assert ap.claim("C_SAFETY").status == "contested" and ap.label_read == "2025-12-16"
    assert any("reading the FDA label" in n for s, n in notes if s == "L2")
    l2 = next(e for e in ap.ledger if e.step == "L2")
    assert {a.tool_name for a in l2.attempts if a.tool_name} >= {"FDA_get_boxed_warning_info_by_drug_name", "OpenTargets_get_drug_warnings_by_chemblId"}
    assert "C_SAFETY ← 1 link(s)" in l2.reasoning.what_this_changes
    c = adapt(ap)["candidate"]
    last = c["safety"][-1]
    assert last["from"] == CURRENT_GOLDEN_SNAPSHOT and last["value"]["severity"] == "boxed" and last["value"]["kind"] == "boxed warning"
    assert last["value"]["flag"] == "QT prolongation and sudden deaths" and last["value"]["label"]["brand"] == "Tasigna"
    assert {x.get("system") for x in last["value"]["systems"]} >= {"blood", "heart and vessels", "liver"}
    assert last["value"]["signals"][0]["name"] == "electrocardiogram qt prolonged" and "not incidence" in last["value"]["signals_note"]
    assert c["safety"][0]["from"] == "2025-12-16" and "signals" not in c["safety"][0]["value"]  # FAERS is cumulative: only at the run date
    safety = next(p for p in c["prerequisites"] if p["id"] == "safety")["status"][-1]["value"]
    assert (safety["resolution"], safety["word"]) == ("conditional", "with monitoring") and "Boxed warning for QT prolongation" in safety["note"]
    assert c["drivers"]["safety"] == 1
    src = next(s for s in c["sources"] if s["id"] == last["value"]["sources"][0])
    assert src["design"] == "label" and src["group"] == "FDA" and src["ledger"] == "L2"


def test_live_run_at_a_historical_cutoff_says_the_label_read_is_dated_later_not_that_it_was_never_read(tu, direct):
    ap = LiveRun(tu=tu, direct=direct).run("nilotinib", "Parkinson disease", PRE_TRIAL_SNAPSHOT)
    assert ap.claim("C_SAFETY").status == "unknown" and ap.label_read == "2025-12-16"
    assert not any(e.safety for e in ap.evidence)  # withheld: nothing dated after the cutoff reaches the appraisal
    c = adapt(ap)["candidate"]
    assert c["safety"] == []  # present but empty → the page's "dated later" copy, not "not assessed"
    safety = next(p for p in c["prerequisites"] if p["id"] == "safety")["status"][-1]["value"]
    assert safety["word"] == "unknown" and "missing data" in safety["note"]


def test_fixture_mode_speaks_from_the_2007_tasigna_label_at_every_cutoff():
    for as_of in (EARLY_SNAPSHOT, PRE_TRIAL_SNAPSHOT, CURRENT_GOLDEN_SNAPSHOT):
        ap = run_fixture(load_bundle(), as_of)
        c = adapt(ap, ledger_kind="scripted")["candidate"]
        assert [x["from"] for x in c["safety"]] == ["2007-10-29"]
        v = c["safety"][0]["value"]
        assert v["flag"] == "QT prolongation and sudden deaths" and v["label"] == {"brand": "Tasigna", "effective": "2007-10-29"}
        assert [x["heading"] for x in v["systems"]][:3] == ["Myelosuppression", "QT prolongation", "Sudden deaths"] and "signals" not in v
        assert f"not for {ap.disease}" in v["population"] and "ECGs" in v["population"]
        safety = next(p for p in c["prerequisites"] if p["id"] == "safety")["status"]
        assert [(x["from"], x["value"]["resolution"], x["value"]["word"]) for x in safety][-1] == ("2007-10-29", "conditional", "with monitoring")
        assert ap.claim("C_SAFETY").status == "contested"


def test_safety_block_severity_ladder():
    b = load_bundle()
    fda = next(e for e in b.evidence if e.safety is not None)
    clean = fda.model_copy(update={"safety": fda.safety.model_copy(update={"boxed_title": None, "boxed_reason": None, "boxed_text": None, "sections": [], "no_warnings": True})})
    warned = fda.model_copy(update={"safety": fda.safety.model_copy(update={"boxed_title": None, "boxed_reason": None, "boxed_text": None})})
    assert label_at([clean, warned, fda]) is fda and label_at([clean, warned]) is warned and label_at([]) is None
    assert safety_block(clean, "x", "2026-09-20", False)["severity"] == "none"
    w = safety_block(warned, "x", "2026-09-20", False)
    assert w["severity"] == "warning" and w["kind"] == "label warning" and w["flag"] == "myelosuppression"


def test_a_withdrawn_drug_with_a_boxed_label_says_withdrawn_first_on_the_claim_and_on_the_record(tu, direct):
    from dataclasses import replace

    ep = run_task(task("safety", "L2"), tu, direct)
    chosen, extra = enrich.drug_safety(task("safety", "L2"), enrich.pick_originator(ep.records), tu, direct, 3)
    withdrawn = replace(chosen, payload={**chosen.payload, "withdrawn": True, "withdrawn_where": "EU"})
    e = evidence_from_label(canonicalize(withdrawn), "nilotinib", "Parkinson disease", ep.attempts + extra)
    assert e.relevance[0].direction == "contradicts" and e.relevance[0].statement.startswith("Tasigna has been withdrawn in EU")
    assert e.statement.startswith("FDA label (Tasigna), effective 2025-12-16: withdrawn in EU; boxed warning for QT prolongation")


def test_a_refuted_safety_claim_outranks_the_label_in_the_fifth_prerequisite():
    from types import SimpleNamespace as NS

    from elute.api.adapt import safety_prerequisite

    b = load_bundle()
    fda = next(e for e in b.evidence if e.safety is not None)
    trial = next(e for e in b.evidence if e.safety is None)
    claim = NS(status="refuted", status_why="Refuted: a blinded, placebo-controlled trial reported unacceptable toxicity.")
    p = safety_prerequisite(fda, claim, NS(against=[trial], supports=[]), "Parkinson disease")
    assert p["resolution"] == "unmet" and p["word"] == "no" and p["sources"] == [trial.id]
    assert p["note"].startswith(claim.status_why) and "Tasigna label" in p["note"]
    # the boxed label alone stays what CLAUDE.md says it is: conditional, with monitoring
    boxed = safety_prerequisite(fda, NS(status="contested", status_why="x"), NS(against=[fda], supports=[]), "Parkinson disease")
    assert boxed["resolution"] == "conditional" and boxed["word"] == "with monitoring"
