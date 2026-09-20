"""Strict output schemas for the model (every field present, nullable where unknown). Converted to the internal
models after validation; the model never sees or produces ids it was not given."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from elute.models import Caveat, ClaimId, Direction, Outcome, Population, StudyType


class PkFactOut(BaseModel):
    value: str
    unit: str | None
    verbatim_sentence: str


class RelevanceOut(BaseModel):
    claim_id: ClaimId
    direction: Direction
    statement: str
    verbatim_sentence: str


class ExtractionOut(BaseModel):
    study_type: StudyType
    controlled: bool | None
    blinded: bool | None
    placebo: bool | None
    population: Population
    sample_size: int | None
    outcome: Outcome | None
    pk_facts: list[PkFactOut]
    caveats: list[Caveat]
    relevance: list[RelevanceOut]
    display_statement: str


class CaseItemOut(BaseModel):
    text: str
    cites: list[str]


class SynthesisOut(BaseModel):
    strongest_case_for: list[CaseItemOut]
    strongest_case_against: list[CaseItemOut]
    opinion: str
    what_would_change_my_mind: str


class ReasoningOut(BaseModel):
    reasoning: str
    evidence_needed: str
    interpretation: str
    what_this_changes: str
    next_action_reason: str


class RefinementOut(BaseModel):
    query: str
    reason: str


class WordingOut(BaseModel):
    why_this_question_matters: str
    cites: list[str]


Kind = Literal["extraction", "synthesis", "reasoning", "refinement", "wording"]
