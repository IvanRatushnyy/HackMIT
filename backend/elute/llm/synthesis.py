"""L9 synthesis, L4/L9 reasoning, L10 wording (BACKEND_PLAN v4.4 §4, §6). The model is handed only
the visible structured record; its output passes the gate or is re-asked once with the rejection reasons, then the
deterministic fallback is used. Nothing here reads dates or raw payloads."""
from __future__ import annotations

from pathlib import Path

from elute.engine.validate import gate
from elute.llm.client import LLMClient
from elute.llm.schemas import ReasoningOut, SynthesisOut, WordingOut
from elute.models import AgentReasoning, CaseItem, Claim, Evidence, NextQuestion, Synthesis
from elute.pipeline.appraisal import STANCE_PHRASE, Derived

P = Path(__file__).parent / "prompts"
SYNTHESIS_PROMPT = (P / "synthesis.md").read_text()
REASONING_PROMPT = (P / "reasoning.md").read_text()
WORDING_PROMPT = (P / "wording.md").read_text()


def evidence_lines(ev: list[Evidence]) -> str:
    lines = []
    for e in ev:
        rel = "; ".join(f"{r.claim_id} {r.direction}: {r.statement}" for r in e.relevance) or "no claim-level finding"
        meta = ", ".join(x for x in [e.study_type, e.population, f"n = {e.sample_size}" if e.sample_size else None, f"outcome {e.outcome}" if e.outcome else None] if x)
        cav = f" caveats: {', '.join(e.caveats)}" if e.caveats else ""
        lines.append(f"{e.id} · {e.source_name} · {e.publication_date} · {meta}{cav}\n    {e.statement}\n    {rel}")
    return "\n".join(lines)


def record_text(d: Derived, ev: list[Evidence], as_of: str) -> str:
    claims = "\n".join(f"- {c.id} [{c.status}]: {c.statement} — {c.status_why}" + (f" (caveats: {', '.join(c.caveats)})" if c.caveats else "") for c in d.claims)
    return (f"as_of: {as_of}\nstance (derived): {d.stance} — phrase: \"{STANCE_PHRASE[d.stance]}\"\n"
            f"weakest link: {d.weakest_link.claim_id} — {d.weakest_link.why}\n"
            f"contradictions: {', '.join(c.id for c in d.contradictions) or 'none'}\nunknowns: {', '.join(c.id for c in d.unknowns) or 'none'}\n\n"
            f"Claims:\n{claims}\n\nVisible evidence:\n{evidence_lines(ev)}")


def _to_synthesis(out: SynthesisOut) -> Synthesis:
    return Synthesis(strongest_case_for=[CaseItem(text=i.text, cites=i.cites) for i in out.strongest_case_for],
                     strongest_case_against=[CaseItem(text=i.text, cites=i.cites) for i in out.strongest_case_against],
                     opinion=out.opinion, what_would_change_my_mind=out.what_would_change_my_mind)


def synthesize(client: LLMClient, d: Derived, ev: list[Evidence], as_of: str) -> tuple[Synthesis | None, list[str]]:
    """Returns (synthesis that passed the gate, or None; the last rejection reasons). One re-ask, then None."""
    system = SYNTHESIS_PROMPT.replace("{as_of}", as_of).replace("{stance_phrase}", STANCE_PHRASE[d.stance])
    user = record_text(d, ev, as_of)
    against = {c.id: [e.id for e in d.results[c.id].against] for c in d.claims}
    problems: list[str] = []
    for attempt in range(2):
        out = client.complete_structured(SynthesisOut, system, user if attempt == 0 else user + "\n\nYour previous answer was rejected for these reasons; fix every one:\n- " + "\n- ".join(problems))
        if out is None:
            return None, problems or ["model unavailable"]
        synth = _to_synthesis(out)
        g = gate(synth, ev, d.claims, d.stance, against)
        if g.ok:
            return synth, []
        problems = g.problems
    return None, problems


def step_reasoning(client: LLMClient, base: AgentReasoning, ev: list[Evidence], status_changes: list[str], attempts_text: str) -> AgentReasoning | None:
    """OpenAI rewrites the interpretive fields of a templated AgentReasoning for L4/L9; the question, tool and next action stay templated."""
    user = (f"Question: {base.question}\nTool used: {base.selected_tool} — {base.tool_selection_reason}\nAttempts:\n{attempts_text}\n"
            f"Status changes derived by the engine: {'; '.join(status_changes) or 'none'}\n\nVisible evidence:\n{evidence_lines(ev)}")
    out = client.complete_structured(ReasoningOut, REASONING_PROMPT, user)
    if out is None:
        return None
    allowed = set(status_changes)
    # what_this_changes may only restate engine-derived changes
    wtc = out.what_this_changes if all(s.split("→")[0].strip() in " ".join(allowed) for s in out.what_this_changes.split(";") if "→" in s) else base.what_this_changes
    return base.model_copy(update={"reasoning": out.reasoning, "evidence_needed": out.evidence_needed, "interpretation": out.interpretation,
                                   "what_this_changes": wtc, "next_action_reason": out.next_action_reason})



def word_next_question(client: LLMClient, nq: NextQuestion, claim: Claim) -> str | None:
    user = f"Question: {nq.next_question}\nGate: {nq.gate} [{claim.status}]\nExperiment: {nq.suggested_experiment_or_data}\nResult that would change the appraisal: {nq.result_that_would_change_appraisal}"
    out = client.complete_structured(WordingOut, WORDING_PROMPT, user)
    if out is None or nq.gate not in out.cites:
        return None
    return out.why_this_question_matters
