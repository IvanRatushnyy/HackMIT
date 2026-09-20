"""The run (BACKEND_PLAN v4.4 §13). Fixture mode here (M2); live mode is added in M5 on the same assembly path so
fixture and live produce the same schema through the same engine."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from elute.engine.validate import ValidationError, gate, validate_structure
from elute.models import (AgentReasoning, CandidateAppraisal, CaseItem, Evidence, FixtureBundle, LedgerEntry,
                          Recommendation, RetrievalCounts, Synthesis)
from elute.pipeline import reasoning as R
from elute.pipeline.appraisal import STANCE_PHRASE, Derived, derive
from elute.pipeline.temporal import audit, visible, withheld

STEP_QUESTIONS = {
    "L1": "What exactly was asked?", "L2": "What is the target, and is it tied to the disease?", "L3": "Has this been tested in people?",
    "L4": "What does the literature say?", "L5": "Is every record a dated statement?", "L6": "What was visible on the requested date?",
    "L7": "What must be true for this to work?", "L8": "What holds, what is contested, what is unknown?",
    "L9": "What is the strongest case each way, and what does Elute think?", "L10": "What should be answered next?",
}
STEP_TASK = {"L1": "resolve", "L2": "biology", "L3": "clinical_trials", "L4": "literature"}


def new_id() -> str:
    return "ap_" + uuid.uuid4().hex[:12]


def today_iso(override: str | None = None) -> str:
    return override or date.today().isoformat()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---- synthesis: curated or fallback ------------------------------------------------------------------

def fallback_synthesis(d: Derived, as_of: str) -> Synthesis:
    """Deterministic prose when no model output passes the gate: claim statements grouped by status, cited by claim id."""
    def items(statuses: tuple[str, ...]) -> list[CaseItem]:
        return [CaseItem(text=f"{c.statement} — {c.status}: {c.status_why}", cites=[c.id] + c.evidence_ids) for c in d.claims if c.status in statuses]

    case_for = items(("established", "single-source")) or [CaseItem(text="No claim is established or singly supported on this date.", cites=[d.claims[0].id])]
    case_against = items(("contested", "refuted", "unknown")) or [CaseItem(text="No claim is contested, refuted or unknown on this date.", cites=[d.claims[0].id])]
    reasons = ", ".join(f"{c.id} is {c.status}" for c in d.contradictions + d.unknowns) or "the visible statuses"
    opinion = f"Based on the evidence visible as of {as_of}, Elute would {STANCE_PHRASE[d.stance]}, primarily because {reasons}."
    return Synthesis(strongest_case_for=case_for, strongest_case_against=case_against, opinion=opinion,
                     what_would_change_my_mind=f"Evidence that resolves {d.next_question.gate}: {d.next_question.result_that_would_change_appraisal}")


def pick_curated(bundle: FixtureBundle, as_of: str) -> Synthesis | None:
    dates = sorted(k for k in bundle.synthesis if k <= as_of)
    return bundle.synthesis[dates[-1]] if dates else None


def apply_gate(synth: Synthesis | None, d: Derived, ev: list[Evidence], as_of: str) -> tuple[Synthesis, str, list[str]]:
    """Returns (synthesis, llm_mode, problems). Curated/model prose that fails the gate is replaced by the fallback."""
    against = {c.id: [e.id for e in d.results[c.id].against] for c in d.claims}
    if synth is not None:
        g = gate(synth, ev, d.claims, d.stance, against)
        if g.ok:
            return synth, "openai", []
        return fallback_synthesis(d, as_of), "fallback", g.problems
    return fallback_synthesis(d, as_of), "unavailable", []


def assemble(*, run_id: str, drug: str, disease: str, as_of: str, resolved, evidence_all: list[Evidence], d: Derived,
             synth: Synthesis, llm: str, data_mode: str, ledger: list[LedgerEntry]) -> CandidateAppraisal:
    ev = visible(evidence_all, as_of)
    problems = validate_structure(ev, d.claims, d.edges)
    if problems:
        raise ValidationError(problems)
    rec = Recommendation(stance=d.stance, opinion=synth.opinion,
                         rationale_claim_ids=[c.id for c in d.contradictions + d.unknowns] or [d.weakest_link.claim_id],
                         supporting_claim_ids=[c.id for c in d.claims if c.status in ("established", "single-source")],
                         opposing_claim_ids=[c.id for c in d.contradictions], key_unknowns=[c.id for c in d.unknowns],
                         what_would_change_my_mind=synth.what_would_change_my_mind)
    return CandidateAppraisal(id=run_id, drug=drug, disease=disease, as_of=as_of, resolved=resolved, data_mode=data_mode, llm=llm,
                              evidence=ev, claims=d.claims, mechanism_edges=d.edges, supporting_evidence_ids=d.supporting_evidence_ids,
                              counter_evidence_ids=d.counter_evidence_ids, strongest_case_for=synth.strongest_case_for,
                              strongest_case_against=synth.strongest_case_against, weakest_link=d.weakest_link, next_question=d.next_question,
                              recommendation=rec, ledger=ledger)


# ---- fixture mode ----------------------------------------------------------------------------------

def run_fixture(bundle: FixtureBundle, as_of: str, run_id: str | None = None) -> CandidateAppraisal:
    run_id = run_id or new_id()
    ev = visible(bundle.evidence, as_of)
    hidden = withheld(bundle.evidence, as_of)
    d = derive(bundle.drug, bundle.disease, bundle.resolved, ev)
    synth, llm, _ = apply_gate(pick_curated(bundle, as_of), d, ev, as_of)
    llm = "openai" if llm == "openai" else llm  # curated prose that passes the gate is reported as curated below
    per_step: dict[str, RetrievalCounts] = {}
    ledger: list[LedgerEntry] = []
    for step in [f"L{i}" for i in range(1, 11)]:
        step_ev = [e for e in ev if e.ledger_step == step]
        step_hidden = [e for e in hidden if e.ledger_step == step]
        counts = RetrievalCounts(results_retrieved=len(step_ev) + len(step_hidden), results_after_dedup=len(step_ev) + len(step_hidden),
                                 results_after_temporal_filter=len(step_ev), records_withheld=len(step_hidden), results_selected_for_extraction=len(step_ev))
        per_step[step] = counts
        reasoning: AgentReasoning = bundle.reasoning[step]
        if step == "L6":
            summary = audit(ev, as_of, per_step)
            reasoning = R.temporal_audit(as_of, summary.evidence_visible, len(hidden))
        elif step == "L8":
            reasoning = R.engine_step(d.claims, d.weakest_link, d.stance)
        elif step == "L10":
            reasoning = R.next_question_step(d.next_question.gate, d.next_question.next_question)
        ledger.append(LedgerEntry(step=step, question=STEP_QUESTIONS[step], task=STEP_TASK.get(step), transport="fixture" if step in STEP_TASK else "none",
                                  tool_name=None, query="", counts=counts, status="ok", timestamp=_now(), elapsed_ms=0,
                                  key_finding=reasoning.interpretation, record_ids=[e.id for e in step_ev], reasoning=reasoning, reasoning_source="template"))
    return assemble(run_id=run_id, drug=bundle.drug, disease=bundle.disease, as_of=as_of, resolved=bundle.resolved, evidence_all=bundle.evidence,
                    d=d, synth=synth, llm=("unavailable" if llm == "openai" else llm), data_mode="fixture", ledger=ledger)
