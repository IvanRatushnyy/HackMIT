"""L4 extraction (BACKEND_PLAN v4.4 §4): one call per selected VISIBLE abstract. Every number, caveat and relevance
must quote a sentence found in the abstract; anything that cannot is dropped here, not trusted."""
from __future__ import annotations

import re
from pathlib import Path

from elute.ids import CLAIM_IDS
from elute.llm.client import LLMClient
from elute.llm.schemas import ExtractionOut
from elute.models import Extraction, PkFact, Relevance
from elute.pipeline.canonicalize import AbstractRecord

PROMPT = (Path(__file__).parent / "prompts" / "extraction.md").read_text()

CLAIM_DEFS = {
    "C_MECHANISM": "the drug inhibits/modulates its target at clinical doses",
    "C_DISEASE_RELEVANCE": "the target is altered in, or causally tied to, the disease biology",
    "C_EXPOSURE": "the drug reaches the target compartment (e.g. the brain/CSF) at a tolerated dose in an inhibiting concentration",
    "C_ENGAGEMENT": "the drug engages its target in patients (a human target-engagement readout)",
    "C_DOWNSTREAM": "engaging the target produces the expected downstream biology (biomarker or pharmacology) in the disease",
    "C_CLINICAL": "the drug improves clinical outcomes in the disease",
    "C_SAFETY": "the drug's safety is acceptable in the likely trial population",
}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _quoted(sentence: str | None, abstract: str) -> bool:
    if not sentence:
        return False
    return _norm(sentence)[:200] in _norm(abstract) or _norm(sentence) in _norm(abstract)


def user_prompt(a: AbstractRecord, drug: str, disease: str, target: str | None) -> str:
    defs = "\n".join(f"- {k}: {v}" for k, v in CLAIM_DEFS.items() if k in CLAIM_IDS)
    return (f"Drug: {drug}\nDisease: {disease}\nTarget: {target or 'not resolved'}\n\nClaims:\n{defs}\n\n"
            f"Title: {a.title}\n\nAbstract:\n{a.abstract}")


def extract(client: LLMClient, a: AbstractRecord, drug: str, disease: str, target: str | None) -> Extraction | None:
    out = client.complete_structured(ExtractionOut, PROMPT, user_prompt(a, drug, disease, target))
    if out is None:
        return None
    blob = a.title + " " + a.abstract
    relevance = [Relevance(claim_id=r.claim_id, direction=r.direction, statement=r.statement, verbatim_sentence=r.verbatim_sentence)
                 for r in out.relevance if r.claim_id in CLAIM_IDS and _quoted(r.verbatim_sentence, blob)]
    pk = [PkFact(value=p.value, unit=p.unit, verbatim_sentence=p.verbatim_sentence) for p in out.pk_facts if _quoted(p.verbatim_sentence, blob)]
    sample = out.sample_size if out.sample_size is not None and str(out.sample_size) in blob else None
    return Extraction(study_type=out.study_type, controlled=out.controlled, blinded=out.blinded, placebo=out.placebo, population=out.population,
                      sample_size=sample, outcome=out.outcome, pk_facts=pk, caveats=list(dict.fromkeys(out.caveats)), relevance=relevance,
                      display_statement=out.display_statement)
