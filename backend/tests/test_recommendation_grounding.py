"""§6: synthesis is accepted only when every sentence cites, every number matches, every contradiction is cited, and the
stance phrase agrees; one re-ask carries the rejection reasons; then the deterministic fallback."""
from __future__ import annotations

from elute.fixtures import aliases_for, load_bundle
from elute.llm.schemas import CaseItemOut, SynthesisOut
from elute.llm.synthesis import synthesize
from elute.pipeline.appraisal import derive
from elute.pipeline.orchestrator import apply_gate, run_fixture
from elute.pipeline.temporal import visible
from tests.constants import CURRENT_GOLDEN_SNAPSHOT, PRE_TRIAL_SNAPSHOT


class Scripted:
    """Returns the scripted outputs in order; records what it was asked."""
    name = "scripted"

    def __init__(self, outputs):
        self.outputs, self.calls = list(outputs), []

    def complete_structured(self, schema, system, user):
        self.calls.append((schema.__name__, system, user))
        return self.outputs.pop(0) if self.outputs else None


def setup(as_of):
    b = load_bundle(); ev = visible(b.evidence, as_of)
    return b, ev, derive(b.drug, b.disease, b.resolved, ev), aliases_for()


def good(a, as_of):
    return SynthesisOut(
        strongest_case_for=[CaseItemOut(text="The mechanism is an approved pharmacology.", cites=[a["fda-label"], "C_MECHANISM"])],
        strongest_case_against=[
            CaseItemOut(text="Brain exposure is contested: CSF/plasma 0.53 % in leukemia patients.", cites=[a["reinwald-2014"], "C_EXPOSURE"]),
            CaseItemOut(text="The efficacy signal is open-label in 12 patients and has a published alternative explanation.", cites=[a["pagan-2016"], a["schwarzschild-2016"], "C_CLINICAL", "C_DOWNSTREAM"]),
            CaseItemOut(text="The label carries a boxed warning.", cites=[a["fda-label"], "C_SAFETY"]),
        ],
        opinion=f"Based on the evidence visible as of {as_of}, Elute would make no clear prioritization, primarily because C_EXPOSURE is contested and C_ENGAGEMENT is unknown.",
        what_would_change_my_mind="A CSF measurement compatible with target inhibition.")


def test_good_output_passes_first_time():
    b, ev, d, a = setup(PRE_TRIAL_SNAPSHOT)
    client = Scripted([good(a, PRE_TRIAL_SNAPSHOT)])
    synth, problems = synthesize(client, d, ev, PRE_TRIAL_SNAPSHOT)
    assert synth is not None and problems == [] and len(client.calls) == 1
    assert "EV_" in client.calls[0][2] and "make no clear prioritization" in client.calls[0][1]


def test_uncited_sentence_invented_number_and_wrong_stance_are_rejected_then_reasked():
    b, ev, d, a = setup(PRE_TRIAL_SNAPSHOT)
    bad = SynthesisOut(strongest_case_for=[CaseItemOut(text="Nilotinib works in 40% of patients.", cites=[])],
                       strongest_case_against=[CaseItemOut(text="Exposure is low.", cites=[a["reinwald-2014"]])],
                       opinion=f"Based on the evidence visible as of {PRE_TRIAL_SNAPSHOT}, Elute would pursue conditionally.", what_would_change_my_mind="x")
    client = Scripted([bad, good(a, PRE_TRIAL_SNAPSHOT)])
    synth, problems = synthesize(client, d, ev, PRE_TRIAL_SNAPSHOT)
    assert synth is not None and len(client.calls) == 2
    second_user = client.calls[1][2]
    assert "rejected" in second_user and "no resolving citation" in second_user and "40" in second_user and "stance phrase" in second_user


def test_two_failures_fall_back_deterministically():
    b, ev, d, a = setup(CURRENT_GOLDEN_SNAPSHOT)
    bad = SynthesisOut(strongest_case_for=[], strongest_case_against=[CaseItemOut(text="It failed.", cites=[])], opinion="No.", what_would_change_my_mind="x")
    client = Scripted([bad, bad])
    synth, problems = synthesize(client, d, ev, CURRENT_GOLDEN_SNAPSHOT)
    assert synth is None and problems
    fb, llm, _ = apply_gate(None, d, ev, CURRENT_GOLDEN_SNAPSHOT)
    assert llm == "unavailable" and "deprioritize" in fb.opinion and all(i.cites for i in fb.strongest_case_against)


def test_ignored_contradiction_is_rejected():
    b, ev, d, a = setup(CURRENT_GOLDEN_SNAPSHOT)
    out = good(a, CURRENT_GOLDEN_SNAPSHOT)
    out.opinion = f"Based on the evidence visible as of {CURRENT_GOLDEN_SNAPSHOT}, Elute would deprioritize nilotinib, primarily because C_EXPOSURE is contested."
    # C_CLINICAL is refuted today; drop every one of its contradicting sources (Schwarzschild, Simuni, Pagan 2020) from the case against
    out.strongest_case_against[1] = CaseItemOut(text="The efficacy signal is open-label in 12 patients.", cites=[a["pagan-2016"], "C_CLINICAL"])
    client = Scripted([out, out])
    synth, problems = synthesize(client, d, ev, CURRENT_GOLDEN_SNAPSHOT)
    assert synth is None and any("C_CLINICAL is refuted" in p for p in problems)


def test_fixture_run_exposes_supporting_opposing_unknowns_and_change_of_mind():
    ap = run_fixture(load_bundle(), CURRENT_GOLDEN_SNAPSHOT)
    r = ap.recommendation
    assert r.supporting_claim_ids and r.opposing_claim_ids and r.key_unknowns == ["C_ENGAGEMENT"] and r.what_would_change_my_mind
    assert "C_CLINICAL" in r.opposing_claim_ids and "C_MECHANISM" in r.supporting_claim_ids
