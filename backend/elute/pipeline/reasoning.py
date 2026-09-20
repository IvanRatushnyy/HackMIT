"""Templated AgentReasoning for the deterministic steps (BACKEND_PLAN v4.4 §4, §7). OpenAI writes L4/L9/L10 reasoning
when configured; everything else — and every fallback — comes from here. Every template names only engine-derived
statuses and counts."""
from __future__ import annotations

from elute.models import AgentReasoning, Claim, RetrievalCounts, WeakestLink


def resolve(drug: str, disease: str, ids: dict[str, str | None]) -> AgentReasoning:
    found = ", ".join(f"{k} → {v}" for k, v in ids.items() if v) or "no identifiers resolved"
    return AgentReasoning(
        question="What exactly was asked?",
        reasoning="Every later query must name the same drug, disease and target, so names are resolved to canonical identifiers first.",
        evidence_needed="A ChEMBL id for the drug, an EFO/MONDO id for the disease, an Ensembl id for the target.",
        selected_tool="Open Targets Platform search", tool_selection_reason="The one structural identifier lookup; no other tool resolves names to ids.",
        interpretation=found, what_this_changes="Nothing yet: identifiers are not evidence.",
        next_action="Ask what the drug does and whether its target is tied to the disease.", next_action_reason="The mechanism is the first link every later claim depends on.")


def retrieval(step: str, question: str, tool: str, tool_reason: str, evidence_needed: str, counts: RetrievalCounts,
              key_finding: str | None, status_changes: list[str], next_action: str, next_reason: str, attempts_note: str | None = None) -> AgentReasoning:
    interp = key_finding or f"{counts.results_after_temporal_filter} visible record(s) after deduplication and the date gate."
    if attempts_note:
        interp += f" {attempts_note}"
    return AgentReasoning(question=question, reasoning=f"This step asks: {question}", evidence_needed=evidence_needed, selected_tool=tool,
                          tool_selection_reason=tool_reason, interpretation=interp,
                          what_this_changes="; ".join(status_changes) if status_changes else "No claim status changed at this step.",
                          next_action=next_action, next_action_reason=next_reason)


def normalize(n_evidence: int) -> AgentReasoning:
    return AgentReasoning(question="Is every record a dated statement?", reasoning="One source record becomes one Evidence with its claim-level findings; a paper is never split per claim.",
                          evidence_needed="Nothing new: this step converts what was retrieved.", selected_tool="normalize", tool_selection_reason="Deterministic; no tool and no model.",
                          interpretation=f"{n_evidence} Evidence record(s), each with provider, transport, date and relevance items.",
                          what_this_changes="Nothing in the science; everything in the bookkeeping.", next_action="Audit historical visibility.", next_action_reason="A leak here would invalidate the backtest.")


def temporal_audit(as_of: str, n_visible: int, withheld_total: int) -> AgentReasoning:
    return AgentReasoning(question=f"What evidence was available by {as_of}?",
                          reasoning="Historical appraisal excludes evidence made public after the requested cutoff; the gate ran inside retrieval, this step verifies it.",
                          evidence_needed="Nothing new: only the dates already on the records.", selected_tool="temporal audit", tool_selection_reason="Deterministic; no tool and no model.",
                          interpretation=f"{n_visible} evidence record(s) retained; {withheld_total} later record(s) withheld at retrieval.",
                          what_this_changes="Nothing, unless a leak is found — then the run fails validation.", next_action="Build the claims.", next_action_reason="The chain is only as strong as its weakest link.")


def claims_step(claims: list[Claim]) -> AgentReasoning:
    unknown = [c.id for c in claims if c.status == "unknown"]
    return AgentReasoning(question="What must be true for this to work?", reasoning="Seven fixed claims: mechanism, disease relevance, exposure, engagement, downstream biology, clinical benefit, safety.",
                          evidence_needed="The relevance items already extracted.", selected_tool="claims", tool_selection_reason="Deterministic; no tool and no model.",
                          interpretation=("No visible evidence bears on: " + ", ".join(unknown) + ".") if unknown else "Every claim has visible evidence.",
                          what_this_changes="; ".join(f"{c} → unknown" for c in unknown) or "No claim is unknown.",
                          next_action="Derive statuses, the weakest link and the stance.", next_action_reason="Every label must be derivable from the record.")


def engine_step(claims: list[Claim], weakest_link: WeakestLink, stance: str) -> AgentReasoning:
    statuses = "; ".join(f"{c.id} → {c.status}" for c in claims)
    return AgentReasoning(question="What holds, what is contested, what is unknown?",
                          reasoning="Six ordered status rules over the visible relevance links; the weakest link by an explicit weakness table; a stance from the statuses alone.",
                          evidence_needed="Nothing new.", selected_tool="engine", tool_selection_reason="Deterministic; no tool and no model.",
                          interpretation=f"Weakest link: {weakest_link.claim_id}. Stance: {stance}.", what_this_changes=statuses,
                          next_action="Write the case for, the case against, and Elute's opinion.", next_action_reason="Prose may only cite what the record holds.")


def synthesis_step(source: str, stance: str) -> AgentReasoning:
    return AgentReasoning(question="What is the strongest case each way, and what does Elute think?",
                          reasoning="Assume the hypothesis is wrong and defend it anyway: both cases, each sentence cited; the opinion is downstream of the derived stance.",
                          evidence_needed="The claims with statuses, the visible evidence, the weakest link, the contradictions and the unknowns.",
                          selected_tool=source, tool_selection_reason="Validated by the citation and number gate before it is returned.",
                          interpretation=f"Stance: {stance}.", what_this_changes="Nothing in the statuses; the opinion is downstream of them.",
                          next_action="Name the one question to answer next.", next_action_reason="A good co-scientist knows the question even when it does not know the answer.")


def next_question_step(gate: str, question: str) -> AgentReasoning:
    return AgentReasoning(question="What should be answered next?", reasoning="The first gate in causal order that is not established is the question that matters most.",
                          evidence_needed="Nothing new.", selected_tool="next question", tool_selection_reason="Deterministic; no tool and no model.",
                          interpretation=f"{gate}: {question}", what_this_changes="The suggested experiment names what would change the appraisal.",
                          next_action="Validate and return the appraisal.", next_action_reason="Nothing is returned that fails the gate.")
