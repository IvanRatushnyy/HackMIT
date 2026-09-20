"""The live run (BACKEND_PLAN v4.4 §13, M5): the ten steps over ToolUniverse with direct fallbacks, the §9.1 literature
order, OpenAI at L4/L9/L10 only, the temporal gate inside retrieval and the audit at L6, the same assembly as fixture
mode. Every step's LedgerEntry is emitted as it starts and settles."""
from __future__ import annotations

import time
from dataclasses import replace
from datetime import datetime, timezone
from typing import Callable

from elute.connectors.base import Attempt as RawAttempt
from elute.connectors.base import Task
from elute.connectors.direct import DirectConnector
from elute.connectors.tooluniverse import ToolUniverseConnector
from elute.llm import extraction as X
from elute.llm import synthesis as S
from elute.llm.client import LLMClient, NullClient
from elute.models import (AgentReasoning, Attempt, CandidateAppraisal, Evidence, LedgerEntry, Resolved, RetrievalCounts)
from elute.pipeline import reasoning as R
from elute.pipeline import tools
from elute.pipeline.appraisal import derive
from elute.pipeline.canonicalize import canonicalize
from elute.pipeline.literature import DEFAULT_FACET_ORDER, NEGATIVE_FIRST_ORDER, retrieve_literature
from elute.pipeline.normalize import evidence_from_article, evidence_from_association, evidence_from_mechanism, evidence_from_trial, outcome_for_trial
from elute.pipeline.orchestrator import STEP_QUESTIONS, STEP_TASK, apply_gate, assemble, new_id
from elute.pipeline.temporal import audit, visible, withheld

Emit = Callable[[str, str, LedgerEntry], None]  # (step, phase, entry)

DISEASE_ALIASES = {"parkinson": ["Parkinson disease", "Parkinson's disease", "Parkinsons disease", "Parkinsonian"]}
TARGET_ALIASES = {"ABL1": ["c-Abl", "Abl"]}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _attempts(raw: list[RawAttempt]) -> list[Attempt]:
    return [Attempt(n=a.n, transport=a.transport, tool_name=a.tool if a.transport == "tooluniverse" else (None if a.tool in tools.TASK_TOOLS.get("literature", ()) + tools.TASK_TOOLS["trials"] + tools.TASK_TOOLS["biology"] + tools.TASK_TOOLS["resolve"] else a.tool),
                    query=a.query, outcome=a.outcome, reason=a.reason, records_returned=a.records_returned, elapsed_ms=a.elapsed_ms) for a in raw]


def _entry(step: str, *, task: str | None, transport: str, tool_name: str | None, query: str, attempts: list[Attempt], counts: RetrievalCounts,
           status: str, started: float, key_finding: str | None, record_ids: list[str], reasoning: AgentReasoning, source: str = "template") -> LedgerEntry:
    return LedgerEntry(step=step, question=STEP_QUESTIONS[step], task=task, transport=transport, tool_name=tool_name, query=query, attempts=attempts,
                       counts=counts, status=status, timestamp=_now(), elapsed_ms=int((time.monotonic() - started) * 1000), key_finding=key_finding,
                       record_ids=record_ids, reasoning=reasoning, reasoning_source=source)


def _status(attempts: list[Attempt], ok: bool) -> str:
    if not ok:
        return "failed"
    return "retried" if any(a.outcome != "ok" for a in attempts if a.tool_name or a.transport) and len(attempts) > 1 else "ok"


class LiveRun:
    def __init__(self, *, tu: ToolUniverseConnector, direct: DirectConnector, llm: LLMClient | None = None, emit: Emit | None = None,
                 demo_disable_tool: str | None = None):
        self.tu, self.direct = tu, direct
        self.llm = llm or NullClient()
        self.emit = emit or (lambda step, phase, entry: None)
        self.demo_disable_tool = demo_disable_tool
        self.ledger: list[LedgerEntry] = []

    def _disabled(self, task_kind: str) -> bool:
        mapping = {"biology": "biology", "trials": "clinical_trials", "literature": "literature"}
        return self.demo_disable_tool is not None and mapping.get(task_kind) == self.demo_disable_tool

    def _settle(self, entry: LedgerEntry) -> None:
        self.ledger.append(entry)
        self.emit(entry.step, "settled", entry)

    def _start(self, step: str, reasoning: AgentReasoning, task: str | None) -> None:
        self.emit(step, "question", LedgerEntry(step=step, question=STEP_QUESTIONS[step], task=task, timestamp=_now(), reasoning=reasoning))

    # ------------------------------------------------------------------------------------------
    def run(self, drug: str, disease: str, as_of: str, run_id: str | None = None) -> CandidateAppraisal:
        run_id = run_id or new_id()
        llm_used = self.llm.name not in ("null",)
        data_mode = "live"
        evidence_all: list[Evidence] = []
        self.evidence_all = evidence_all  # the emit callback reads it for the settled rows' records
        aliases = next((v for k, v in DISEASE_ALIASES.items() if k in disease.lower()), [disease])
        base = Task("L1", "resolve", STEP_QUESTIONS["L1"], drug=drug, disease=disease, disease_aliases=aliases)

        # ---- L1 resolve -------------------------------------------------------------------------
        t0 = time.monotonic()
        self._start("L1", R.resolve(drug, disease, {}), "resolve")
        attempts: list[Attempt] = []
        ep_drug = tools.run_task(replace(base, drug_chembl_id=None, target_symbol=None), self.tu, self.direct, disabled=self._disabled)
        attempts += _attempts(ep_drug.attempts)
        drug_id = ep_drug.records[0].payload.get("id") if ep_drug.records else None
        ep_dis = tools.run_task(replace(base, drug_chembl_id=drug_id or "", target_symbol=None), self.tu, self.direct, disabled=self._disabled)
        attempts += _attempts(ep_dis.attempts)
        dis_id = ep_dis.records[0].payload.get("id") if ep_dis.records else None
        dis_name = ep_dis.records[0].payload.get("name") if ep_dis.records else disease
        resolved = Resolved(drug_chembl_id=drug_id, disease_efo_id=dis_id, disease_name=dis_name or disease, drug_name=drug)
        ok = bool(drug_id and dis_id)
        reasoning = R.resolve(drug, disease, {"drug": drug_id, "disease": dis_id})
        self._settle(_entry("L1", task="resolve", transport=(ep_dis.transport or ep_drug.transport or "none"), tool_name=ep_dis.selected_tool, query=f"{drug} · {disease}",
                            attempts=attempts, counts=RetrievalCounts(), status="ok" if ok else "failed", started=t0, key_finding=reasoning.interpretation, record_ids=[], reasoning=reasoning))
        if not ok:
            data_mode = "mixed"
        base = replace(base, id="L2", drug_chembl_id=drug_id, disease_efo_id=dis_id, disease=resolved.disease_name or disease,
                       disease_aliases=list(dict.fromkeys([resolved.disease_name or disease] + aliases)))

        # ---- L2 biology ----------------------------------------------------------------------------
        t0 = time.monotonic()
        self._start("L2", R.retrieval("L2", STEP_QUESTIONS["L2"], "OpenTargets_get_drug_mechanisms_of_action_by_chemblId", "the task's preferred ToolUniverse tool for biology",
                                      "the curated mechanism of action and target–disease association evidence", RetrievalCounts(), None, [], "Ask whether this has been tested in people.", "Clinical evidence is what candidates die of first."), "biology")
        attempts = []
        step_ev: list[Evidence] = []
        ep_moa = tools.run_task(replace(base, kind="biology", target_ensembl_id=None), self.tu, self.direct, disabled=self._disabled) if drug_id else None
        target_symbol = None
        if ep_moa is not None:
            attempts += _attempts(ep_moa.attempts)
            rows = [canonicalize(r) for r in ep_moa.records]
            for c in rows:
                if not target_symbol:
                    syms = [t.get("approvedSymbol") for t in c.payload.get("targets") or []]
                    if syms and (c.payload.get("actionType") or "").upper() in ("INHIBITOR", "ANTAGONIST", "BLOCKER"):
                        target_symbol = syms[0]
            resolved.target_symbol = target_symbol
            step_ev += [e for e in (evidence_from_mechanism(c, resolved, ep_moa.attempts) for c in rows) if e]
        if target_symbol:
            ep_t = tools.run_task(replace(base, kind="resolve", target_symbol=target_symbol, drug_chembl_id=None), self.tu, self.direct, disabled=self._disabled)
            attempts += _attempts(ep_t.attempts)
            resolved.target_ensembl_id = ep_t.records[0].payload.get("id") if ep_t.records else None
            base = replace(base, target_symbol=target_symbol, target_aliases=TARGET_ALIASES.get(target_symbol, []), target_ensembl_id=resolved.target_ensembl_id)
            if resolved.target_ensembl_id and dis_id:
                ep_as = tools.run_task(replace(base, kind="biology"), self.tu, self.direct, disabled=self._disabled)
                attempts += _attempts(ep_as.attempts)
                step_ev += [e for e in (evidence_from_association(canonicalize(r), resolved, ep_as.attempts) for r in ep_as.records) if e]
        vis2 = visible(step_ev, as_of)
        counts = RetrievalCounts(results_retrieved=len(step_ev), results_after_dedup=len(step_ev), results_after_temporal_filter=len(vis2), records_withheld=len(step_ev) - len(vis2), results_selected_for_extraction=len(vis2))
        evidence_all += vis2
        ok2 = ep_moa is not None and ep_moa.status == "ok"
        interp = (f"Mechanism: {target_symbol or 'no inhibitory target row'}; {sum(1 for e in vis2 if e.evidence_kind == 'association')} association row(s) visible on {as_of}.")
        reasoning = R.retrieval("L2", STEP_QUESTIONS["L2"], ep_moa.selected_tool if ep_moa else "—", "the task's preferred ToolUniverse tool for biology; the direct API is the recorded fallback",
                                "the curated mechanism of action and target–disease association evidence", counts, interp,
                                [f"C_MECHANISM ← {len([e for e in vis2 if any(r.claim_id == 'C_MECHANISM' for r in e.relevance)])} link(s)"], "Ask whether this has been tested in people.", "Clinical evidence is what candidates die of first.")
        self._settle(_entry("L2", task="biology", transport=(ep_moa.transport if ep_moa and ep_moa.transport else "none"), tool_name=(ep_moa.selected_tool if ep_moa else None),
                            query=drug_id or "", attempts=attempts, counts=counts, status=_status(attempts, ok2), started=t0, key_finding=interp, record_ids=[e.id for e in vis2], reasoning=reasoning))
        if not ok2:
            data_mode = "mixed"

        # ---- L3 trials -------------------------------------------------------------------------------
        t0 = time.monotonic()
        self._start("L3", R.retrieval("L3", STEP_QUESTIONS["L3"], "ClinicalTrials_search_studies", "the task's preferred ToolUniverse tool for trials", "registered trials with phase, enrollment, masking, status and posted dates", RetrievalCounts(), None, [], "", ""), "clinical_trials")
        ep_tr = tools.run_task(replace(base, id="L3", kind="trials"), self.tu, self.direct, disabled=self._disabled)
        trial_canon = [canonicalize(r) for r in ep_tr.records]
        trial_ev_all = [e for e in (evidence_from_trial(c, ep_tr.attempts) for c in trial_canon) if e]
        vis3 = visible(trial_ev_all, as_of)
        counts = RetrievalCounts(results_retrieved=len(ep_tr.records), results_after_dedup=len(trial_ev_all), results_after_temporal_filter=len(vis3), records_withheld=len(trial_ev_all) - len(vis3), results_selected_for_extraction=len(vis3))
        evidence_all += vis3
        controlled_result_visible = any(e.evidence_kind == "results" and e.controlled and e.blinded for e in vis3)
        interp = f"{sum(1 for e in vis3 if e.evidence_kind == 'registration')} registration(s) and {sum(1 for e in vis3 if e.evidence_kind == 'results')} results record(s) visible on {as_of}; registrations link nothing; results carry an outcome only from a matched primary publication."
        reasoning = R.retrieval("L3", STEP_QUESTIONS["L3"], ep_tr.selected_tool or "—", "the task's preferred ToolUniverse tool for trials; masking and posted dates from the recorded ctgov.study_design supplement",
                                "registered trials with phase, enrollment, masking, status and posted dates", counts, interp, [], "Ask what the literature says about exposure, engagement, biomarkers and criticism.",
                                "The trials name the questions; the papers hold the evidence.", attempts_note=("A controlled result is already visible, so the literature search leads with exposure and engagement." if controlled_result_visible else None))
        self._settle(_entry("L3", task="clinical_trials", transport=ep_tr.transport or "none", tool_name=ep_tr.selected_tool, query=str(ep_tr.attempts[0].query) if ep_tr.attempts else "",
                            attempts=_attempts(ep_tr.attempts), counts=counts, status=_status(_attempts(ep_tr.attempts), ep_tr.status == "ok"), started=t0, key_finding=interp, record_ids=[e.id for e in vis3], reasoning=reasoning))
        if ep_tr.status != "ok":
            data_mode = "mixed"

        # ---- L4 literature: retrieval + visibility gate + extraction ----------------------------------
        t0 = time.monotonic()
        self._start("L4", R.retrieval("L4", STEP_QUESTIONS["L4"], "PubMed_search_articles", "the task's preferred ToolUniverse tool for literature", "dated abstracts per facet, visible on the requested date only", RetrievalCounts(), None, [], "", ""), "literature")
        order = NEGATIVE_FIRST_ORDER if controlled_result_visible else DEFAULT_FACET_ORDER
        lit = retrieve_literature(replace(base, id="L4", kind="literature"), as_of, self.tu, self.direct, facet_order=order, disabled=self._disabled)
        extractions = {}
        for c in lit.selected:
            a = lit.abstracts.get(c.key)
            if a is not None and llm_used:
                extractions[c.key] = X.extract(self.llm, a, drug, resolved.disease_name or disease, resolved.target_symbol)
        article_ev = [e for e in (evidence_from_article(c, lit.abstracts.get(c.key), extractions.get(c.key), lit.attempts) for c in lit.selected) if e]
        # dynamic follow-ups (§11.2): one extra query per unresolved gate, bounded
        extras = []
        if not any(r.claim_id == "C_EXPOSURE" for e in article_ev for r in e.relevance):
            extras.append("exposure")
        if not any(r.claim_id == "C_ENGAGEMENT" for e in article_ev for r in e.relevance):
            extras.append("engagement")
        if extras and llm_used:
            more = retrieve_literature(replace(base, id="L4", kind="literature"), as_of, self.tu, self.direct, facet_order=[], extra_queries=extras, disabled=self._disabled)
            seen = {e.source_record_id for e in article_ev}
            for c in more.selected:
                if c.key in seen:
                    continue
                a = more.abstracts.get(c.key)
                ex = X.extract(self.llm, a, drug, resolved.disease_name or disease, resolved.target_symbol) if a is not None else None
                e = evidence_from_article(c, a, ex, more.attempts)
                if e:
                    article_ev.append(e)
            lit.attempts += more.attempts
        evidence_all += visible(article_ev, as_of)
        vis4 = visible(article_ev, as_of)
        l4_attempts = _attempts(lit.attempts)
        changes = [f"{cid} ← {n} link(s)" for cid, n in sorted({r.claim_id: sum(1 for e in vis4 for x in e.relevance if x.claim_id == r.claim_id) for e in vis4 for r in e.relevance}.items())]
        interp = f"{lit.counts.results_retrieved} retrieved → {lit.counts.results_after_dedup} after dedup → {lit.counts.results_after_temporal_filter} visible on {as_of} → {lit.counts.results_selected_for_extraction} selected; {len(lit.abstracts)} abstracts read" + ("" if llm_used else "; no model configured, so no claim-level findings were extracted")
        base_r = R.retrieval("L4", STEP_QUESTIONS["L4"], lit.selected_tool or "PubMed_search_articles", "the task's preferred ToolUniverse tool for literature; abstracts fetched only for the selected visible records",
                             "dated abstracts per facet, visible on the requested date only", lit.counts, interp, changes, "Normalize every record into dated Evidence.", "Nothing downstream may read a raw payload.")
        source = "template"
        if llm_used:
            att_text = "\n".join(f"{a.n}. {a.transport} {a.tool_name or ''} {a.outcome} ({a.records_returned})" for a in l4_attempts)
            rr = S.step_reasoning(self.llm, base_r, vis4, changes, att_text)
            if rr is not None:
                base_r, source = rr, "openai"
        self._settle(_entry("L4", task="literature", transport=lit.transport or "none", tool_name=lit.selected_tool, query=f"{len(order)} facets", attempts=l4_attempts, counts=lit.counts,
                            status="failed" if lit.status == "failed" else lit.status, started=t0, key_finding=interp, record_ids=[e.id for e in vis4], reasoning=base_r, source=source))
        if lit.status == "failed":
            data_mode = "mixed"

        # trial results carry an outcome only from a matched primary publication
        for i, e in enumerate(evidence_all):
            if e.evidence_kind == "results" and e.outcome == "na":
                o = outcome_for_trial(e.source_record_id.split("|")[0], vis4)
                if o:
                    evidence_all[i] = e.model_copy(update={"outcome": o, "statement": e.statement.replace("outcome not stated in the registry record", f"primary publication outcome: {o}")})

        # ---- L5 normalize --------------------------------------------------------------------------------
        t0 = time.monotonic()
        reasoning = R.normalize(len(evidence_all))
        self._settle(_entry("L5", task=None, transport="none", tool_name=None, query="", attempts=[], counts=RetrievalCounts(), status="ok", started=t0, key_finding=reasoning.interpretation, record_ids=[e.id for e in evidence_all], reasoning=reasoning))

        # ---- L6 temporal audit -----------------------------------------------------------------------------
        t0 = time.monotonic()
        per_step = {e.step: e.counts for e in self.ledger if e.step in ("L2", "L3", "L4")}
        summary = audit(evidence_all, as_of, per_step)  # raises TemporalLeak on any leak → the run fails validation
        reasoning = R.temporal_audit(as_of, summary.evidence_visible, summary.records_withheld_total)
        self._settle(_entry("L6", task=None, transport="none", tool_name=None, query="", attempts=[], counts=RetrievalCounts(results_after_temporal_filter=summary.evidence_visible, records_withheld=summary.records_withheld_total),
                            status="ok", started=t0, key_finding=reasoning.interpretation, record_ids=[], reasoning=reasoning))

        # ---- L7/L8 claims + engine --------------------------------------------------------------------------
        t0 = time.monotonic()
        d = derive(drug, resolved.disease_name or disease, resolved, evidence_all)
        reasoning = R.claims_step(d.claims)
        self._settle(_entry("L7", task=None, transport="none", tool_name=None, query="", attempts=[], counts=RetrievalCounts(), status="ok", started=t0, key_finding=reasoning.interpretation, record_ids=[], reasoning=reasoning))
        t0 = time.monotonic()
        reasoning = R.engine_step(d.claims, d.weakest_link, d.stance)
        self._settle(_entry("L8", task=None, transport="none", tool_name=None, query="", attempts=[], counts=RetrievalCounts(), status="ok", started=t0, key_finding=reasoning.interpretation, record_ids=[], reasoning=reasoning))

        # ---- L9 synthesis ----------------------------------------------------------------------------------------
        t0 = time.monotonic()
        synth, problems = (S.synthesize(self.llm, d, evidence_all, as_of) if llm_used else (None, ["model unavailable"]))
        synth_final, llm_mode, _ = apply_gate(synth, d, evidence_all, as_of)
        if llm_mode == "openai" and not llm_used:
            llm_mode = "unavailable"
        if synth is None and llm_used:
            llm_mode = "fallback" if problems and problems != ["model unavailable"] else "unavailable"
        reasoning = R.synthesis_step("OpenAI synthesis" if llm_mode == "openai" else "deterministic fallback", d.stance)
        self._settle(_entry("L9", task=None, transport="none", tool_name=None, query="", attempts=[], counts=RetrievalCounts(), status="ok" if llm_mode == "openai" else "retried",
                            started=t0, key_finding=("gate rejected: " + "; ".join(problems[:3])) if problems and llm_mode != "openai" else reasoning.interpretation, record_ids=[], reasoning=reasoning,
                            source="openai" if llm_mode == "openai" else "template"))

        # ---- L10 next question + validate --------------------------------------------------------------------------
        t0 = time.monotonic()
        nq = d.next_question
        if llm_used:
            worded = S.word_next_question(self.llm, nq, d.claims[[c.id for c in d.claims].index(nq.gate)])
            if worded:
                d.next_question = nq.model_copy(update={"why_this_question_matters": worded})
        reasoning = R.next_question_step(nq.gate, nq.next_question)
        self._settle(_entry("L10", task=None, transport="none", tool_name=None, query="", attempts=[], counts=RetrievalCounts(), status="ok", started=t0, key_finding=reasoning.interpretation, record_ids=[], reasoning=reasoning))

        return assemble(run_id=run_id, drug=drug, disease=resolved.disease_name or disease, as_of=as_of, resolved=resolved, evidence_all=evidence_all, d=d,
                        synth=synth_final, llm=llm_mode, data_mode=data_mode, ledger=self.ledger)
