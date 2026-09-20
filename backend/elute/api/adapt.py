"""CandidateAppraisal → the frontend's CandidateDetail + QueryRecord (BACKEND_PLAN v4.4 §8). The frontend re-derives
labels from `chain.claims[].evidence` + `sources` with the same six rules, so the adapter passes links, not labels.
`validateCandidate` (frontend) must pass on the result at every cutoff."""
from __future__ import annotations

import re
from typing import Any

from elute.engine.labels import passes_refutes_gate
from elute.engine.weakest_link import WEAKNESS, weakest
from elute.ids import CAUSAL_ORDER
from elute.models import CandidateAppraisal, Evidence, LedgerEntry
from elute.pipeline.appraisal import derive
from elute.pipeline.temporal import visible

EARLY, PRE_TRIAL = "2016-07-11", "2017-11-20"
CHAIN_IDS = [c for c in CAUSAL_ORDER if c != "C_SAFETY"]
PREREQ = [("exposure", "C_EXPOSURE", "Brain (or tissue) exposure at tolerated doses"), ("engagement", "C_ENGAGEMENT", "Target engagement measured in patients"),
          ("blinding", "C_CLINICAL", "Benefit under blinding"), ("biomarker", "C_DOWNSTREAM", "Biomarker validated against an alternative"),
          ("safety", "C_SAFETY", "Safety acceptable in the likely population")]
SHORT = {"C_MECHANISM": "inhibits {target}", "C_DISEASE_RELEVANCE": "{target} altered in {disease}", "C_EXPOSURE": "exposure at tolerated doses",
         "C_ENGAGEMENT": "target engagement in patients", "C_DOWNSTREAM": "downstream biology in patients", "C_CLINICAL": "improves outcomes in patients"}
PIPS = {"established": 3, "single-source": 2, "contested": 1, "unknown": 1, "refuted": 0}
STEP_NAMES = {"L1": "Resolve the query", "L2": "Target and disease biology", "L3": "Registered trials, blinding and n extracted", "L4": "Literature, study design classified",
              "L5": "Normalize to evidence", "L6": "Historical visibility audit", "L7": "Claims and mechanism", "L8": "Statuses, weakest link, stance",
              "L9": "Case for, case against, opinion", "L10": "Next question"}
STEP_UNITS = {"L1": "identifiers", "L2": "records", "L3": "trials", "L4": "papers", "L5": "records", "L6": "records", "L7": "claims", "L8": "statuses", "L9": "cases", "L10": "questions"}
DESIGN = {"rct": "rct", "open-label": "open-label", "pk": "pk", "commentary": "commentary", "observational": "observational", "preclinical": "preclinical",
          "protocol": "protocol", "label": "label", "regulatory": "regulatory", "meta-analysis": "meta-analysis", "unknown": "observational"}


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("’", "").replace("'", "")).strip("-")


def _source(e: Evidence) -> dict[str, Any]:
    return {"id": e.id, "first_author": e.first_author, "journal": e.journal, "year": e.year, "published": e.publication_date, "title": e.statement,
            "design": DESIGN[e.study_type], "controlled": bool(e.controlled), **({"blinded": e.blinded} if e.blinded is not None else {}),
            **({"n": e.sample_size} if e.sample_size is not None else {}), "outcome": e.outcome or "na", "group": e.group or "unknown", "url": e.source_url, "ledger": e.ledger_step}


def _scope(caveats: list[str]) -> str | None:
    if "animal-model" in caveats:
        return "in mouse models"
    if "postmortem-tissue" in caveats:
        return "in postmortem tissue"
    if "cell-line" in caveats:
        return "in cell models"
    return None


def _cutoffs(as_of: str) -> list[dict[str, str]]:
    out = []
    if EARLY <= as_of:
        out.append({"id": "jul-2016", "label": "Jul 2016", "date": EARLY, "note": "Evidence visible on 11 Jul 2016 — the day the Georgetown pilot was published."})
    if PRE_TRIAL <= as_of and PRE_TRIAL != as_of:
        out.append({"id": "nov-2017", "label": "Nov 2017", "date": PRE_TRIAL, "note": "Evidence visible on 20 Nov 2017 — the day NILO-PD enrolled its first patient."})
    if not out or out[-1]["date"] != as_of:
        out.append({"id": "today", "label": "Today" if as_of >= "2026-01-01" else as_of, "date": as_of, "note": f"Evidence visible on {as_of}."})
    else:
        out[-1] = {**out[-1], "id": "today"}
    return out


def _dates_of_change(ap: CandidateAppraisal, cutoffs: list[dict[str, str]]) -> list[str]:
    return sorted({e.publication_date for e in ap.evidence} | {c["date"] for c in cutoffs})


def _derived_at(ap: CandidateAppraisal, date: str):
    return derive(ap.drug, ap.disease, ap.resolved, visible(ap.evidence, date))


def adapt(ap: CandidateAppraisal, *, ledger_kind: str = "recorded") -> dict[str, Any]:
    ev_by = ap.evidence_by_id()
    drug_slug, disease_slug = slugify(ap.drug), slugify(ap.disease)
    target = ap.resolved.target_symbol or "target"
    cutoffs = _cutoffs(ap.as_of)
    dates = _dates_of_change(ap, cutoffs)

    # ---- chain (six claims), links not labels
    claims = []
    for c in ap.claims:
        if c.id == "C_SAFETY":
            continue
        links = []
        for e in ap.evidence:
            for r in e.relevance:
                if r.claim_id != c.id:
                    continue
                d = "supports" if r.direction == "qualifies" else r.direction
                if d == "refutes" and not passes_refutes_gate(e):
                    d = "contradicts"
                if not any(l["source"] == e.id and l["direction"] == d for l in links):
                    links.append({"source": e.id, "direction": d})
        claim = {"id": c.id, "node": c.node, "short": SHORT[c.id].format(target=target, disease=ap.disease), "text": c.statement, "evidence": links}
        if (sc := _scope(c.caveats)):
            claim["scope"] = sc
        if c.id in ("C_MECHANISM", "C_DISEASE_RELEVANCE", "C_ENGAGEMENT") and ap.resolved.target_symbol:
            claim["genes"] = [ap.resolved.target_symbol]
        claims.append(claim)

    # ---- objections from the case against
    objections = []
    for i, item in enumerate(ap.strongest_case_against):
        cited = [c for c in item.cites if c in ev_by]
        published = max((ev_by[c].publication_date for c in cited), default=ap.as_of)
        head, _, tail = item.text.partition(": ")
        fig = re.search(r"\d+(?:\.\d+)?\s?%|n = \d+|\d+ patients", item.text)
        objections.append({"id": f"o{i + 1}", "consequence_rank": i + 1, "claim": (head if tail else item.text.split(". ")[0]).rstrip(".") + ".",
                           "evidence": tail or item.text, **({"figure": fig.group(0)} if fig else {}), "published": published, "sources": cited,
                           "cites": sorted({ev_by[c].ledger_step for c in cited}) or ["L8"]})

    # ---- timelines: recompute the engine at every date the record changes
    prereq_tl: dict[str, list[dict[str, Any]]] = {pid: [] for pid, _, _ in PREREQ}
    best_tl: list[dict[str, Any]] = []
    weak_tl: list[dict[str, Any]] = []
    for date in dates:
        if date > ap.as_of:
            continue
        d = _derived_at(ap, date)
        by = {c.id: c for c in d.claims}
        for pid, cid, _ in PREREQ:
            c = by[cid]
            res = {"established": "met", "single-source": "conditional"}.get(c.status, "unmet")
            word = {"established": "shown", "single-source": "one study", "contested": "contested", "refuted": "no", "unknown": "unknown"}[c.status]
            entry = {"resolution": res, "word": word, "note": c.status_why, "sources": [e.id for e in d.results[cid].against] or [e.id for e in d.results[cid].supports]}
            tl = prereq_tl[pid]
            if not tl or (tl[-1]["value"]["resolution"], tl[-1]["value"]["word"], tl[-1]["value"]["note"]) != (res, word, entry["note"]):
                tl.append({"from": date, "value": entry})
        # best evidence for the clinical claim
        clin = [ev_by[i] for i in by["C_CLINICAL"].evidence_ids if i in ev_by]
        if clin:
            top = max(clin, key=lambda e: (bool(e.controlled), e.blinded is True, e.sample_size or 0))
            be = {"design": ("blinded RCT" if top.study_type == "rct" and top.blinded else top.study_type), "controlled": bool(top.controlled),
                  "outcome": top.outcome if top.outcome in ("positive", "negative", "mixed") else "mixed", **({"n": top.sample_size} if top.sample_size else {}),
                  "source": top.id, "stage": "phase-2" if top.study_type == "rct" else ("open-label" if top.study_type == "open-label" else "preclinical"), "label": top.source_name}
        else:
            be = {"design": "no human study", "controlled": False, "outcome": "none", "stage": "preclinical"}
        if not best_tl or best_tl[-1]["value"] != be:
            best_tl.append({"from": date, "value": be})
        chain_claims = [c for c in d.claims if c.id != "C_SAFETY"]
        w = weakest(chain_claims, d.results)
        wl = {"claim": w.claim_id, "why": w.why, "sources": [i for i in w.evidence_ids if i in ev_by]}
        if not weak_tl or (weak_tl[-1]["value"]["claim"], weak_tl[-1]["value"]["why"]) != (wl["claim"], wl["why"]):
            weak_tl.append({"from": date, "value": wl})

    today = _derived_at(ap, ap.as_of)
    st = {c.id: c.status for c in today.claims}
    mech = next((e for e in ap.evidence if e.evidence_kind == "mechanism" and any(r.claim_id == "C_MECHANISM" for r in e.relevance)), None)
    action = re.search(r"is an? (?:curated )?(\w[\w -]*?) of", mech.statement + " " + " ".join(r.statement for r in mech.relevance)) if mech else None
    drug_class = f"{target} {action.group(1)}" if action else f"{target}-directed drug"
    indication = re.search(r"approved for ([^;.]+)", mech.statement) if mech else None

    candidate = {
        "slug": f"{drug_slug}--{disease_slug}", "name": ap.drug[:1].upper() + ap.drug[1:], "drug_class": drug_class,
        "approved_indication": indication.group(1) if indication else "an approved indication (not retrieved in Phase 1)", "condition": ap.disease,
        "condition_slug": disease_slug, "drug_slug": drug_slug, "mechanism": f"{ap.drug} → {target} → downstream biology", "chembl_id": ap.resolved.drug_chembl_id,
        "curation": "curated" if ap.data_mode == "fixture" else "draft", "cutoffs": cutoffs, "sources": [_source(e) for e in ap.evidence], "objections": objections,
        "chain": {"drug": ap.drug, "condition": ap.disease, "claims": claims},
        "prerequisites": [{"id": pid, "condition": cond, "status": prereq_tl[pid]} for pid, _, cond in PREREQ],
        "drivers": {"mechanism": PIPS[st["C_MECHANISM"]], "clinical": PIPS[st["C_CLINICAL"]], "exposure": PIPS[st["C_EXPOSURE"]], "safety": PIPS[st["C_SAFETY"]]},
        "best_evidence": best_tl, "weakest_link": weak_tl,
        "counts": {"sources": len(ap.evidence), "trials": sum(1 for e in ap.evidence if e.evidence_kind == "registration")},
        "recommendation": ap.recommendation.model_dump(mode="json"), "next_question": ap.next_question.model_dump(mode="json"),
        "strongest_case_for": [i.model_dump(mode="json") for i in ap.strongest_case_for],
        "claim_statuses": {c.id: {"status": c.status, "why": c.status_why} for c in ap.claims},
        "data_mode": ap.data_mode, "llm": ap.llm, "appraisal_id": ap.id,
    }
    query = {
        "slug": f"{drug_slug}--{disease_slug}", "kind": "pair", "heading": f"{ap.drug} for {ap.disease}",
        "resolved": f"{ap.resolved.disease_efo_id or 'unresolved'} · {ap.resolved.drug_chembl_id or 'unresolved'} · resolved via Open Targets",
        "ledger": {"kind": ledger_kind, "recorded_total_ms": sum(e.elapsed_ms or 0 for e in ap.ledger), "rows": [ledger_row(e, ap.evidence) for e in ap.ledger]},
        "candidates": [f"{drug_slug}--{disease_slug}"], "pair": {"candidate": drug_slug, "condition": disease_slug},
        "data_mode": ap.data_mode, "appraisal_id": ap.id,
    }
    return {"candidate": candidate, "query": query}


def ledger_row(e: LedgerEntry, evidence: list[Evidence]) -> dict[str, Any]:
    by = {x.id: x for x in evidence}
    first_bad = next((a for a in e.attempts if a.outcome != "ok"), None)
    tool = e.tool_name or (e.transport if e.transport not in ("none", "fixture") else "engine")
    return {"id": e.step, "step": STEP_NAMES[e.step], "source": tool if e.task else "Elute engine", "unit": STEP_UNITS[e.step],
            **({"elapsed_ms": e.elapsed_ms} if e.elapsed_ms is not None else {}),
            "execution": {"tool": tool, "query": e.query or (str(e.attempts[0].query) if e.attempts else ""),
                          "run_at": e.timestamp, **({"retry": {"reason": first_bad.reason or first_bad.outcome, "query": str(first_bad.query)}} if first_bad else {}),
                          "verified": {"by": "automated"}},
            "records": [{"value": by[i].statement[:160], "published": by[i].publication_date, "source": i} for i in e.record_ids if i in by],
            "reasoning": e.reasoning.model_dump(mode="json"), "reasoning_source": e.reasoning_source, "attempts": [a.model_dump(mode="json") for a in e.attempts],
            "counts": e.counts.model_dump(mode="json"), "status": e.status, "transport": e.transport}
