"""The bounded in-step tool loop (BACKEND_PLAN v4.4 §11.2). Per task: ≤ 3 attempts, never a loop.

  attempt 1  the selector picks a ToolUniverse tool from the task's fixed list and words the query
  outcome    code evaluates: error/timeout → path A · empty or no record mentions the resolved entity → path B · ok
  path A     the next attempt is the direct API with the SAME arguments
  path B     the next attempt is a reformulation (selector) on the same transport; if still not ok, direct with the last query
  stop       after 3 attempts, or the first ok

The selector is the model's slot: it chooses among the listed tools and words queries; `DefaultSelector` is the
deterministic stand-in used when there is no key, and in tests. Sufficiency is always checked by code as well.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from elute.connectors import enrich
from elute.connectors.base import Attempt, CacheMiss, RawRecord, Task, ToolError, Transport
from elute.connectors.direct import DirectConnector
from elute.connectors.records import records_for
from elute.connectors.tooluniverse import ToolUniverseConnector

TASK_TOOLS: dict[str, tuple[str, ...]] = {
    "resolve": ("OpenTargets_get_drug_chembId_by_generic_name", "OpenTargets_get_disease_id_description_by_name",
                "OpenTargets_get_target_id_description_by_name"),
    "biology": ("OpenTargets_get_drug_mechanisms_of_action_by_chemblId", "OpenTargets_get_evidence_by_datasource",
                "OpenTargets_get_target_id_description_by_name"),
    "trials": ("ClinicalTrials_search_studies",),
    "literature": ("PubMed_search_articles", "PubMed_get_article"),
    "safety": ("FDA_get_boxed_warning_info_by_drug_name",),
}

# The eight literature facets (§9 L4), as query templates both PubMed and Europe PMC accept.
# `{disease}` and `{target}` are term expressions built by `disease_expr` / `target_expr`: the canonical name unquoted
# on the first attempt (PubMed's automatic term mapping reaches the MeSH heading), the aliases OR-ed on a reformulation.
LITERATURE_FACETS: dict[str, str] = {
    "mechanism": '{drug} AND {target}',
    "disease-hypothesis": '{target} AND {disease}',
    "exposure": '{drug} AND ("cerebrospinal fluid" OR "CSF/plasma" OR "blood-brain barrier" OR "brain penetration" OR "central nervous system")',
    "engagement": '{drug} AND ("target engagement" OR phosphorylation OR "kinase activity") AND ({disease} OR patients)',
    "biomarker": '{drug} AND {disease} AND (biomarker OR "homovanillic acid" OR "alpha-synuclein" OR "cerebrospinal fluid")',
    "efficacy": '{drug} AND {disease} AND (trial OR randomized OR placebo OR efficacy OR "open-label")',
    "criticism": '{drug} AND {disease} AND (comment OR letter OR limitation OR "open-label" OR critique)',
    "alternative": '{drug} AND {disease} AND ("MAO-B" OR "monoamine oxidase" OR withdrawal OR confound OR "alternative explanation")',
}


def _term(name: str) -> str:
    return f'"{name}"' if " " in name else name


def disease_expr(task: Task, reformulated: bool) -> str:
    canonical = task.disease_aliases[0] if task.disease_aliases else task.disease
    if not reformulated:
        return f"({canonical})"
    names = list(dict.fromkeys(task.disease_aliases or [task.disease]))
    stem = canonical.split()[0]
    if len(stem) > 3:
        names.append(stem)
    return "(" + " OR ".join(_term(n) for n in names) + ")"


def target_expr(task: Task, reformulated: bool) -> str:
    names = [task.target_symbol] if task.target_symbol else []
    if reformulated or not names:
        names += task.target_aliases
    return "(" + " OR ".join(_term(n) for n in names if n) + ")" if names else ""
LITERATURE_LIMIT = 100


@dataclass
class Selection:
    tool: str
    arguments: dict[str, Any]
    reason: str


@dataclass
class Episode:
    task_id: str
    attempts: list[Attempt] = field(default_factory=list)
    records: list[RawRecord] = field(default_factory=list)
    transport: Transport | None = None  # the transport whose records counted
    selected_tool: str | None = None
    status: str = "failed"  # ok | failed
    hidden_reason: str | None = None


class Selector(Protocol):
    def select(self, task: Task, attempts: list[Attempt]) -> Selection: ...


class DefaultSelector:
    """Deterministic: canonical names, the facet template, and one reformulation (aliases joined by OR)."""

    def select(self, task: Task, attempts: list[Attempt]) -> Selection:
        reformulated = bool(attempts)
        disease = task.disease_aliases[0] if task.disease_aliases else task.disease
        if task.kind == "resolve":
            if task.target_symbol:
                return Selection("OpenTargets_get_target_id_description_by_name", {"targetName": task.target_symbol}, "resolve the target symbol to an Ensembl id")
            if task.drug_chembl_id is None:
                return Selection("OpenTargets_get_drug_chembId_by_generic_name", {"drugName": task.drug}, "resolve the drug's ChEMBL id")
            return Selection("OpenTargets_get_disease_id_description_by_name", {"diseaseName": disease}, "resolve the disease to an EFO/MONDO id")
        if task.kind == "biology":
            if task.target_ensembl_id and task.disease_efo_id:
                return Selection("OpenTargets_get_evidence_by_datasource",
                                 {"efoId": task.disease_efo_id, "ensemblId": task.target_ensembl_id, "size": 50},
                                 "target ↔ disease evidence, stated per datasource with its literature")
            return Selection("OpenTargets_get_drug_mechanisms_of_action_by_chemblId", {"chemblId": task.drug_chembl_id or ""},
                             "curated mechanism of action names the target and the action type")
        if task.kind == "safety":
            return Selection("FDA_get_boxed_warning_info_by_drug_name", {"drug_name": task.drug, "limit": 25},
                             "the FDA label's boxed warning for every product of this drug; sections, set ids and effective dates from the recorded openFDA supplement")
        if task.kind == "trials":
            return Selection("ClinicalTrials_search_studies",
                             {"query_cond": disease_expr(task, reformulated), "query_intr": f"({task.drug})", "page_size": 100},
                             "registered trials of this drug in this condition, with phase, enrollment, status and dates")
        template = LITERATURE_FACETS[task.facet or "efficacy"]
        query = template.format(drug=task.drug, disease=disease_expr(task, reformulated), target=target_expr(task, reformulated))
        return Selection("PubMed_search_articles", {"query": query, "limit": LITERATURE_LIMIT, "include_abstract": False},
                         f"literature facet '{task.facet}': metadata only; abstracts are fetched after the date gate for the selected records"
                         + (" — reformulated with the canonical name and its synonyms" if reformulated else ""))


def sufficient(task: Task, records: list[RawRecord]) -> tuple[bool, str | None]:
    """Code-level sufficiency: the records must mention the resolved entity (path B trigger)."""
    if not records:
        return False, "0 records"
    if task.kind in ("trials", "literature"):
        names = [n.lower() for n in ([task.disease] + task.disease_aliases) if n]
        hits = [r for r in records if any(n in r.text.lower() for n in names)]
        if not hits:
            return False, f"{len(records)} records, none mentions {task.disease_aliases[0] if task.disease_aliases else task.disease}"
    if task.kind == "safety" and not any(task.drug.lower() in r.text.lower() for r in records):
        return False, f"{len(records)} label(s), none names {task.drug}"
    return True, None


DEMO_DISABLED_REASON = "This tool call was intentionally disabled to demonstrate recovery."


def run_task(task: Task, tu: ToolUniverseConnector, direct: DirectConnector, selector: Selector | None = None, *,
             supplements: bool = True, max_attempts: int = 3, disabled: Callable[[str], bool] | None = None) -> Episode:
    """`disabled(task_kind)` is the transparent fault injection of BACKEND_PLAN §12 (ELUTE_DEMO_DISABLE_TOOL): attempt 1
    on ToolUniverse is recorded as an error with DEMO_DISABLED_REASON and the loop proceeds to the direct fallback."""
    selector = selector or DefaultSelector()
    ep = Episode(task_id=task.id)
    allowed = TASK_TOOLS[task.kind]
    next_transport: Transport = "tooluniverse"
    selection = selector.select(task, [])
    while len(ep.attempts) < max_attempts:
        if selection.tool not in allowed:
            raise ValueError(f"{selection.tool} is not in the list for {task.kind}: {allowed}")
        n = len(ep.attempts) + 1
        conn = tu if next_transport == "tooluniverse" else direct
        t0 = time.monotonic()
        try:
            if next_transport == "tooluniverse" and disabled is not None and disabled(task.kind):
                raise ToolError(DEMO_DISABLED_REASON, retriable=True, kind="demo-disabled")
            payload, elapsed, _ = conn.call(selection.tool, selection.arguments)
        except (ToolError, CacheMiss) as e:
            elapsed = int((time.monotonic() - t0) * 1000)
            outcome = "timeout" if getattr(e, "kind", "") == "timeout" else "error"
            ep.attempts.append(Attempt(n, next_transport, selection.tool, selection.arguments, outcome, 0, elapsed, str(e)))
            if next_transport == "direct":
                break  # both transports failed: the step settles `failed`
            next_transport = "direct"  # path A: same query, direct API
            continue
        records = records_for(selection.tool, task, next_transport, payload)
        ok, reason = sufficient(task, records)
        outcome = "ok" if ok else ("empty" if not records else "insufficient")
        ep.attempts.append(Attempt(n, next_transport, selection.tool, selection.arguments, outcome, len(records), elapsed, reason))
        if ok:
            ep.records, ep.transport, ep.selected_tool, ep.status = records, next_transport, selection.tool, "ok"
            break
        if next_transport == "tooluniverse" and n == 1:
            selection = selector.select(task, ep.attempts)  # path B: reformulate, same transport
            if selection.arguments == ep.attempts[-1].query:
                next_transport = "direct"  # nothing to reformulate: go direct with the same query
        else:
            next_transport = "direct"  # last resort: direct with the last query
    if ep.status == "ok" and supplements:
        n = len(ep.attempts) + 1
        if task.kind == "biology" and any(r.pmid for r in ep.records):  # literature dates run once on the deduplicated set (literature.py)
            ep.records, a = enrich.literature_dates(task, ep.records, direct, n)
            if a:
                ep.attempts.append(a)
        elif task.kind == "trials":
            ep.records, extra = enrich.trial_design(task, ep.records, direct, n)
            ep.attempts.extend(extra)
        elif task.kind == "safety":
            ep.records, a = enrich.label_meta(task, ep.records, direct, n)
            if a:
                ep.attempts.append(a)
    return ep
