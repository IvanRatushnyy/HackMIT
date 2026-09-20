"""The Phase 1 data contract (BACKEND_PLAN v4.4 §7). Kept small; every field here is used by the engine, the trace,
the gate, or the frontend adapter. Pydantic v2 models; the wire format is their JSON."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from elute.ids import CLAIM_IDS

SourceProvider = Literal["open_targets", "clinicaltrials_gov", "pubmed", "europe_pmc", "fixture"]
EvidenceKind = Literal["registration", "results", "publication", "mechanism", "association"]
Transport = Literal["tooluniverse", "direct", "fixture"]
Direction = Literal["supports", "contradicts", "refutes", "qualifies"]
StudyType = Literal["rct", "open-label", "pk", "commentary", "observational", "preclinical", "protocol", "label", "meta-analysis", "unknown"]
Population = Literal["human", "animal", "cell-line", "postmortem", "na", "unknown"]
Caveat = Literal["open-label", "no-placebo", "animal-model", "cell-line", "postmortem-tissue", "exposure-not-measured",
                 "surrogate-biomarker", "small-n", "single-site", "not-prespecified", "retracted", "design-unknown"]
DateConfidence = Literal["exact", "month", "year", "unknown"]
Outcome = Literal["positive", "negative", "mixed", "na"]
Status = Literal["established", "single-source", "contested", "refuted", "unknown"]
ClaimId = Literal["C_MECHANISM", "C_DISEASE_RELEVANCE", "C_EXPOSURE", "C_ENGAGEMENT", "C_DOWNSTREAM", "C_CLINICAL", "C_SAFETY"]
Stance = Literal["deprioritize", "no_clear_prioritization", "pursue_conditionally", "insufficient_evidence"]
DataMode = Literal["fixture", "live", "mixed"]
LlmMode = Literal["openai", "unavailable", "fallback"]
AttemptOutcome = Literal["ok", "error", "timeout", "empty", "insufficient"]
EntryStatus = Literal["ok", "retried", "failed", "skipped"]


class Relevance(BaseModel):
    """One atomic claim-level finding from a source — the only input to claim status."""

    claim_id: ClaimId
    direction: Direction
    statement: str
    verbatim_sentence: str | None = None


class PkFact(BaseModel):
    value: str
    unit: str | None = None
    verbatim_sentence: str


class Supplement(BaseModel):
    tool: str
    transport: Literal["direct"] = "direct"
    outcome: AttemptOutcome = "ok"


class Evidence(BaseModel):
    """One source record: one publication, one trial record, one Open Targets row. Never split per claim."""

    id: str
    source_provider: SourceProvider
    source_record_id: str
    evidence_kind: EvidenceKind
    transport: Transport
    tool_name: str | None = None
    supplements: list[Supplement] = Field(default_factory=list)
    statement: str  # source-level display summary; never the unit of scientific truth
    source_name: str
    source_url: str
    publication_date: str
    date_confidence: DateConfidence = "exact"
    date_basis: str | None = None
    study_type: StudyType = "unknown"
    controlled: bool | None = None
    blinded: bool | None = None
    placebo: bool | None = None
    sample_size: int | None = None
    outcome: Outcome | None = None
    population: Population = "unknown"
    caveats: list[Caveat] = Field(default_factory=list)
    pk_facts: list[PkFact] = Field(default_factory=list)
    relevance: list[Relevance] = Field(default_factory=list)
    independence_group: str = "unknown"
    authors: list[str] = Field(default_factory=list)
    affiliation: str | None = None
    ledger_step: str
    # required by the frontend's publishability validator
    first_author: str
    journal: str
    year: int
    group: str = "unknown"

    @field_validator("id")
    @classmethod
    def _ev_prefix(cls, v: str) -> str:
        if not v.startswith("EV_") or len(v) != 15:
            raise ValueError("evidence id must be EV_ + 12 hex chars")
        return v

    @field_validator("publication_date")
    @classmethod
    def _iso(cls, v: str) -> str:
        if len(v) != 10 or v[4] != "-" or v[7] != "-":
            raise ValueError("publication_date must be ISO YYYY-MM-DD")
        return v


class Claim(BaseModel):
    id: ClaimId
    gate: str
    statement: str
    node: str
    evidence_ids: list[str] = Field(default_factory=list)
    status: Status = "unknown"
    status_why: str = ""
    caveats: list[str] = Field(default_factory=list)


class MechanismEdge(BaseModel):
    source: str
    relation: str
    target: str
    claim_id: ClaimId


class Attempt(BaseModel):
    n: int
    transport: Transport
    tool_name: str | None = None
    query: dict[str, Any] = Field(default_factory=dict)
    outcome: AttemptOutcome
    reason: str | None = None
    records_returned: int = 0
    elapsed_ms: int = 0


class RetrievalCounts(BaseModel):
    results_retrieved: int = 0
    results_after_dedup: int = 0
    results_after_temporal_filter: int = 0
    records_withheld: int = 0
    results_selected_for_extraction: int = 0


class AgentReasoning(BaseModel):
    """Structured, user-facing reasoning for one step — an explicit output, never hidden model state."""

    question: str
    reasoning: str
    evidence_needed: str
    selected_tool: str
    tool_selection_reason: str
    interpretation: str
    what_this_changes: str
    next_action: str
    next_action_reason: str


class LedgerEntry(BaseModel):
    step: str  # "L1".."L10"
    question: str
    task: Literal["resolve", "biology", "clinical_trials", "literature"] | None = None
    transport: Literal["tooluniverse", "direct", "fixture", "none"] = "none"
    tool_name: str | None = None
    query: str = ""
    attempts: list[Attempt] = Field(default_factory=list)
    counts: RetrievalCounts = Field(default_factory=RetrievalCounts)
    status: EntryStatus = "ok"
    timestamp: str
    elapsed_ms: int | None = None
    key_finding: str | None = None
    record_ids: list[str] = Field(default_factory=list)
    reasoning: AgentReasoning
    reasoning_source: Literal["template", "openai"] = "template"


class NextQuestion(BaseModel):
    next_question: str
    why_this_question_matters: str
    suggested_experiment_or_data: str
    result_that_would_change_appraisal: str
    gate: ClaimId


class Recommendation(BaseModel):
    stance: Stance
    opinion: str
    rationale_claim_ids: list[ClaimId] = Field(default_factory=list)
    supporting_claim_ids: list[ClaimId] = Field(default_factory=list)
    opposing_claim_ids: list[ClaimId] = Field(default_factory=list)
    key_unknowns: list[ClaimId] = Field(default_factory=list)
    what_would_change_my_mind: str


class CaseItem(BaseModel):
    text: str
    cites: list[str] = Field(default_factory=list)  # evidence ids and/or claim ids


class WeakestLink(BaseModel):
    claim_id: ClaimId
    why: str
    evidence_ids: list[str] = Field(default_factory=list)


class Resolved(BaseModel):
    drug_chembl_id: str | None = None
    disease_efo_id: str | None = None
    target_ensembl_id: str | None = None
    target_symbol: str | None = None
    disease_name: str | None = None
    drug_name: str | None = None


class CandidateAppraisal(BaseModel):
    id: str
    drug: str
    disease: str
    as_of: str
    resolved: Resolved = Field(default_factory=Resolved)
    data_mode: DataMode
    llm: LlmMode
    evidence: list[Evidence]
    claims: list[Claim]
    mechanism_edges: list[MechanismEdge]
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    counter_evidence_ids: list[str] = Field(default_factory=list)
    strongest_case_for: list[CaseItem]
    strongest_case_against: list[CaseItem]
    weakest_link: WeakestLink
    next_question: NextQuestion
    recommendation: Recommendation
    ledger: list[LedgerEntry]

    def evidence_by_id(self) -> dict[str, Evidence]:
        return {e.id: e for e in self.evidence}

    def claim(self, claim_id: str) -> Claim:
        return next(c for c in self.claims if c.id == claim_id)


class Extraction(BaseModel):
    """What OpenAI reads out of one visible abstract (§4). Every number, caveat and relevance carries a verbatim
    sentence found in the abstract; a relevance without one is dropped by the caller."""

    study_type: StudyType = "unknown"
    controlled: bool | None = None
    blinded: bool | None = None
    placebo: bool | None = None
    population: Population = "unknown"
    sample_size: int | None = None
    outcome: Outcome | None = None
    pk_facts: list[PkFact] = Field(default_factory=list)
    caveats: list[Caveat] = Field(default_factory=list)
    relevance: list[Relevance] = Field(default_factory=list)
    display_statement: str = ""


# ---- the curated fixture bundle (§7) ------------------------------------------------------------

class Synthesis(BaseModel):
    """Curated prose for one cutoff; validated by the same gate as OpenAI output."""

    strongest_case_for: list[CaseItem]
    strongest_case_against: list[CaseItem]
    opinion: str
    what_would_change_my_mind: str


class FixtureBundle(BaseModel):
    drug: str
    disease: str
    resolved: Resolved
    evidence: list[Evidence]
    reasoning: dict[str, AgentReasoning]  # "L1".."L10"
    synthesis: dict[str, Synthesis]  # keyed by ISO cutoff date


assert set(CLAIM_IDS) == set(ClaimId.__args__)  # type: ignore[attr-defined]
