"""One highest-value next question (BACKEND_PLAN v4.4 §5): the first gate in causal order whose status is not
`established`; one template per gate. Not a planner."""
from __future__ import annotations

from elute.ids import GATE_ORDER
from elute.models import Claim, NextQuestion, Resolved
from elute.pipeline.claims import compartment_for


def next_question(claims: list[Claim], drug: str, disease: str, resolved: Resolved) -> NextQuestion:
    by = {c.id: c for c in claims}
    gate = next((g for g in GATE_ORDER if by[g].status != "established"), "C_SAFETY")
    target = resolved.target_symbol or "the target"
    comp = compartment_for(disease)
    status = by[gate].status
    t = {
        "C_EXPOSURE": (
            f"Does {drug} reach {comp} at a therapeutically meaningful concentration at a tolerated dose?",
            f"Exposure at the site of action is the first pillar: without it, target engagement and the downstream mechanism are implausible regardless of how strong the target rationale is. Its status is {status}.",
            f"Measure the {'CSF/plasma' if 'nervous' in comp else 'tissue/plasma'} concentration of {drug} at tolerated dosing in {disease} patients, against the concentration needed to inhibit {target}.",
            f"Reproducible exposure in {comp} compatible with {target} inhibition at a tolerated dose."),
        "C_ENGAGEMENT": (
            f"Even where {drug} reaches {comp}, does it engage {target} in patients?",
            f"Exposure is not engagement: a drug can be present without inhibiting its target at the site of action. Its status is {status}.",
            f"A target-engagement readout in patient samples (for {target}: a phospho-substrate or activity assay) at the dose intended for a trial.",
            f"A reproducible human {target} engagement signal at a tolerated dose."),
        "C_DOWNSTREAM": (
            f"If {target} is engaged, does the expected downstream biology occur in {disease} patients?",
            f"Target engagement only matters if the downstream pharmacology it should cause is actually observed, with alternative explanations excluded. Its status is {status}.",
            "Measure the downstream biomarker under blinding, with the known alternative explanation controlled for (medication changes held constant).",
            "The biomarker moves in a placebo-controlled study with the confounder excluded."),
        "C_CLINICAL": (
            f"Does {drug} improve clinical outcomes in {disease} under blinding?",
            f"Uncontrolled signals do not survive blinding often enough to plan on; the clinical claim's status is {status}.",
            "A randomised, blinded, placebo-controlled study powered for a pre-specified primary clinical endpoint.",
            "A positive pre-specified primary endpoint under blinding."),
        "C_SAFETY": (
            f"Is {drug} acceptably safe in the likely {disease} trial population?",
            f"Every upstream gate is established; what remains is whether the population that would be enrolled can take the drug. Its status is {status}.",
            "A safety run-in in the likely population with the label's warnings monitored (for this drug, the flagged organ systems and interactions).",
            "Acceptable tolerability in the likely population under the monitoring a trial would use."),
    }[gate]
    return NextQuestion(next_question=t[0], why_this_question_matters=t[1], suggested_experiment_or_data=t[2], result_that_would_change_appraisal=t[3], gate=gate)
