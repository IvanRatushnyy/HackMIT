"""L5 normalize (BACKEND_PLAN v4.4 §7, §13): visible canonical records (+ abstracts, + extraction) → canonical Evidence.
One source record = one Evidence. Provenance separates source_provider, transport and tool_name. No raw content
flows further than this module."""
from __future__ import annotations

from elute.connectors.base import Attempt
from elute.engine.independence import independence_group, normalize_author
from elute.engine.labels import passes_refutes_gate
from elute.ids import evidence_id
from elute.models import Direction, Evidence, Extraction, LabelSafety, LabelSection, Population, Relevance, Resolved, SafetySignal, StudyType, Supplement
from elute.pipeline import label as L
from elute.pipeline.canonicalize import AbstractRecord, CanonRecord

PROVIDER_BY_TOOL = {"PubMed_search_articles": "pubmed", "PubMed_get_article": "pubmed", "ClinicalTrials_search_studies": "clinicaltrials_gov"}


def _confidence(date_basis: str) -> str:
    if "last day of year" in date_basis:
        return "year"
    if "last day of month" in date_basis:
        return "month"
    return "unknown" if date_basis == "undated" else "exact"


def _supplements(attempts: list[Attempt], names: tuple[str, ...]) -> list[Supplement]:
    return [Supplement(tool=a.tool, transport=a.transport, outcome=a.outcome) for a in attempts if a.tool in names and a.transport in ("direct", "tooluniverse")]


def _tool_name(c: CanonRecord) -> str | None:
    return c.tool if c.transport == "tooluniverse" else None


# Claim applicability (§4, defence in depth behind the extraction prompt): C_CLINICAL means a clinically meaningful
# effect in HUMAN patients with the disease, so only a human study that itself reports patient outcomes may support
# or qualify it. Animal, cell-line or postmortem findings belong to the biological claims; a commentary, review or
# protocol that discusses another study's result supplies no positive clinical evidence of its own.
NON_CLINICAL_STUDY_TYPES: frozenset[StudyType] = frozenset({"commentary", "protocol", "preclinical"})


def positive_link_applies(claim_id: str, direction: Direction, study_type: StudyType, population: Population) -> bool:
    """False when a supports/qualifies link may not count toward the claim; contradicts/refutes are never touched here."""
    if claim_id != "C_CLINICAL" or direction not in ("supports", "qualifies"):
        return True
    return population == "human" and study_type not in NON_CLINICAL_STUDY_TYPES


def evidence_from_article(c: CanonRecord, abstract: AbstractRecord | None, extraction: Extraction | None, attempts: list[Attempt], step: str = "L4") -> Evidence | None:
    if not c.published:
        return None
    provider = "pubmed"
    first = c.authors[0] if c.authors else "Unknown"
    year = int(c.year) if c.year and c.year.isdigit() else int(c.published[:4])
    authors = abstract.authors if abstract and abstract.authors else c.authors
    affiliation = (abstract.affiliations[0] if abstract and abstract.affiliations else c.affiliation)
    group = independence_group(authors, affiliation)
    ex = extraction or Extraction()
    # a refutes that fails the gate is stored as contradicts (§5)
    relevance: list[Relevance] = []
    for r in ex.relevance:
        if not r.verbatim_sentence:
            continue
        d = r.direction
        if d == "refutes" and not (bool(ex.controlled) and ex.blinded is True and ex.outcome == "negative"):
            d = "contradicts"
        if not positive_link_applies(r.claim_id, d, ex.study_type, ex.population):  # non-human or non-study positive clinical link: dropped, the record stays
            continue
        relevance.append(Relevance(claim_id=r.claim_id, direction=d, statement=r.statement, verbatim_sentence=r.verbatim_sentence))
    statement = ex.display_statement or f"{first} {year}, {c.journal or ''}: {c.title}".strip()
    return Evidence(id=evidence_id(provider, c.key, "publication", c.published), source_provider=provider, source_record_id=c.key, evidence_kind="publication",
                    transport=c.transport, tool_name=_tool_name(c), supplements=_supplements(attempts, ("europepmc.dates",)), statement=statement,
                    source_name=c.source_name, source_url=c.url, publication_date=c.published, date_confidence=_confidence(c.date_basis), date_basis=c.date_basis,
                    study_type=ex.study_type, controlled=ex.controlled, blinded=ex.blinded, placebo=ex.placebo, sample_size=ex.sample_size, outcome=ex.outcome,
                    population=ex.population, caveats=list(ex.caveats), pk_facts=list(ex.pk_facts), relevance=relevance, independence_group=group,
                    authors=[a for a in (normalize_author(x) for x in authors) if a], affiliation=affiliation, ledger_step=step,
                    first_author=first, journal=c.journal or "", year=year, group=group)


def evidence_from_trial(c: CanonRecord, attempts: list[Attempt], outcome_from_publication: str | None = None, step: str = "L3") -> Evidence | None:
    if not c.published or not c.nct_id:
        return None
    p = c.payload
    design = p.get("design") or {}
    kind = "results" if c.kind == "trial-results" else "registration"
    masking = (design.get("masking") or "").upper()
    blinded = None if not masking else masking != "NONE"
    allocation = (design.get("allocation") or "").upper()
    controlled = True if allocation == "RANDOMIZED" else (None if not allocation else False)
    n = p.get("enrollment")
    sponsor = p.get("sponsor") or "sponsor"
    phases = ", ".join(p.get("phases") or []) or "phase not stated"
    if kind == "registration":
        statement = (f"{c.nct_id} registration: {p.get('brief_title') or ''}; {phases}; {'randomised' if controlled else 'allocation not stated'}, "
                     f"masking {masking.lower() or 'not stated'}, n = {n if n is not None else 'not stated'}; first posted {c.published}.")
    else:
        statement = f"{c.nct_id} results posted {c.published}" + (f"; primary publication outcome: {outcome_from_publication}" if outcome_from_publication else "; outcome not stated in the registry record") + "."
    year = int(c.published[:4])
    return Evidence(id=evidence_id("clinicaltrials_gov", c.key, kind, c.published), source_provider="clinicaltrials_gov", source_record_id=c.key, evidence_kind=kind,
                    transport=c.transport, tool_name=_tool_name(c), supplements=_supplements(attempts, ("ctgov.study_design",)), statement=statement,
                    source_name=c.source_name, source_url=c.url, publication_date=c.published, date_confidence=_confidence(c.date_basis), date_basis=c.date_basis,
                    study_type="protocol" if kind == "registration" else ("rct" if controlled and blinded else "unknown"), controlled=controlled, blinded=blinded,
                    placebo=None, sample_size=int(n) if isinstance(n, int) else None, outcome=(outcome_from_publication or "na") if kind == "results" else "na",
                    population="human", relevance=[], independence_group=f"{sponsor.lower()}|" if sponsor else "unknown", ledger_step=step,
                    first_author=f"{sponsor} (sponsor)", journal=f"ClinicalTrials.gov {c.nct_id}", year=year, group=sponsor)


def evidence_from_mechanism(c: CanonRecord, resolved: Resolved, attempts: list[Attempt], step: str = "L2") -> Evidence | None:
    if not c.published:
        return None
    p = c.payload
    symbols = [t.get("approvedSymbol", "") for t in p.get("targets") or []]
    action = (p.get("actionType") or "").lower()
    target = resolved.target_symbol
    hits_target = bool(target) and target in symbols
    drug = p.get("drug_name") or "the drug"
    statement = f"Open Targets (ChEMBL-curated) mechanism: {drug} is a {action or 'modulator'} of {p.get('targetName') or ', '.join(symbols)}."
    rel = []
    if hits_target and action in ("inhibitor", "antagonist", "blocker", "negative modulator", "negative allosteric modulator"):
        rel.append(Relevance(claim_id="C_MECHANISM", direction="supports", statement=f"{drug} is a curated {action} of {target}.",
                             verbatim_sentence=f"{p.get('mechanismOfAction') or ''} ({action}) — {p.get('targetName') or ''}".strip()))
    fda = "accessdata.fda.gov" in (c.url or "")
    return Evidence(id=evidence_id("open_targets", c.key, "mechanism", c.published), source_provider="open_targets", source_record_id=c.key, evidence_kind="mechanism",
                    transport=c.transport, tool_name=_tool_name(c), statement=statement, source_name=c.source_name, source_url=c.url, publication_date=c.published,
                    date_confidence=_confidence(c.date_basis), date_basis=c.date_basis, study_type="label" if fda else "unknown", controlled=False, population="human" if fda else "unknown",
                    outcome="na", relevance=rel, independence_group="fda|" if fda else "open targets|", ledger_step=step,
                    first_author="FDA" if fda else "Open Targets", journal="Tasigna prescribing information" if fda else "Open Targets Platform", year=int(c.published[:4]), group="FDA" if fda else "Open Targets")


def evidence_from_association(c: CanonRecord, resolved: Resolved, attempts: list[Attempt], step: str = "L2") -> Evidence | None:
    if not c.published or not c.pmid:
        return None
    p = c.payload
    ds = p.get("datasourceId") or "?"
    score = p.get("score")
    target = resolved.target_symbol or (p.get("target") or {}).get("approvedSymbol") or "the target"
    disease = p.get("disease_name") or resolved.disease_name or "the disease"
    statement = f"Open Targets association row ({ds}, {p.get('datatypeId') or '?'}): PMID {c.pmid} links {target} with {disease}" + (f", score {score:.2f}" if isinstance(score, (int, float)) else "") + "."
    rel = [Relevance(claim_id="C_DISEASE_RELEVANCE", direction="supports", statement=f"A publication indexed by Open Targets ({ds}) associates {target} with {disease}.",
                     verbatim_sentence=f"datasourceId={ds}; literature={c.pmid}")]
    return Evidence(id=evidence_id("open_targets", c.key, "association", c.published), source_provider="open_targets", source_record_id=c.key, evidence_kind="association",
                    transport=c.transport, tool_name=_tool_name(c), supplements=_supplements(attempts, ("europepmc.dates",)), statement=statement, source_name=c.source_name,
                    source_url=c.url, publication_date=c.published, date_confidence=_confidence(c.date_basis), date_basis=c.date_basis, study_type="unknown", population="unknown",
                    relevance=rel, independence_group="unknown", ledger_step=step, first_author="Open Targets", journal=f"Open Targets · {ds}", year=int(c.published[:4]), group="unknown")


SAFETY_SUPPLEMENTS = ("openfda.label", "OpenTargets_get_drug_warnings_by_chemblId", "OpenTargets_get_drug_adverse_events_by_chemblId")


def evidence_from_label(c: CanonRecord, drug: str, disease: str, attempts: list[Attempt], step: str = "L2") -> Evidence | None:
    """One FDA label → one Evidence on C_SAFETY, dated by the label version's `effective_time`. A boxed warning or a
    withdrawal argues against "safety acceptable in the likely population"; a label with warnings but no box
    qualifies it; a label that lists no warnings supports it. The structured facts travel on `safety`."""
    if not c.published:
        return None
    p = c.payload
    brand = p.get("brand_name") or drug
    generic = (p.get("generic_name") or drug).lower()
    boxed = p.get("boxed_warning")
    title, reason = L.parse_boxed(boxed)
    section_text = p.get("warnings_and_cautions") or p.get("warnings") or p.get("precautions")
    sections = [LabelSection(heading=h, detail=d, system=L.system_for(h)) for h, d in L.parse_sections(section_text)]
    no_warnings = bool(section_text) and not sections and L._NONE.match(section_text) is not None
    withdrawn = bool(p.get("withdrawn"))
    where = p.get("withdrawn_where")
    indication = L.parse_indication(p.get("indications_and_usage"))
    facts = LabelSafety(boxed_title=title, boxed_reason=reason, boxed_text=L.clean(boxed, 700) or None, sections=sections,
                        contraindications=L.dedupe_sentences(_strip_header(p.get("contraindications")), 300) or None, indication=indication,
                        toxicity_classes=list(p.get("toxicity_classes") or []), withdrawn=withdrawn, withdrawn_where=where,
                        signals=[SafetySignal(name=s["name"], reports=int(s["reports"])) for s in (p.get("signals") or []) if s.get("name") and not _names_indication(s["name"], indication)],
                        signals_total=p.get("signals_total"), no_warnings=no_warnings, brand=brand, set_id=p.get("set_id"),
                        version=str(p["version"]) if p.get("version") is not None else None)
    rel: list[Relevance] = []
    if withdrawn:
        rel.append(Relevance(claim_id="C_SAFETY", direction="contradicts", statement=f"{brand} has been withdrawn{' in ' + where if where else ''}.",
                             verbatim_sentence=f"Withdrawn{' (' + where + ')' if where else ''} — Open Targets drug warnings"))
    elif title:
        rel.append(Relevance(claim_id="C_SAFETY", direction="contradicts", statement=f"The label carries a boxed warning for {L.lower_first(title)}.",
                             verbatim_sentence=L.clean(boxed, 300)))
    elif sections:
        heads = ", ".join(s.heading.lower() for s in sections[:4])
        rel.append(Relevance(claim_id="C_SAFETY", direction="qualifies", statement=f"The label carries no boxed warning; it warns of {heads}.",
                             verbatim_sentence=L.clean(section_text, 300)))
    elif no_warnings:
        rel.append(Relevance(claim_id="C_SAFETY", direction="supports", statement="The label lists no warnings.", verbatim_sentence=L.clean(section_text, 120)))
    if withdrawn:  # the same precedence as the relevance edge above, so the statement never disagrees with the claim
        what = f"withdrawn{' in ' + where if where else ''}" + (f"; boxed warning for {L.lower_first(title)}" if title else "")
    elif title:
        what = f"boxed warning for {L.lower_first(title)}"
    elif sections or no_warnings:
        what = "no boxed warning"
    else:
        what = "no boxed warning on record; warnings not readable"
    statement = f"FDA label ({brand}), effective {c.published}: {what}" + (f"; {len(sections)} warning section{'s' if len(sections) != 1 else ''}" if sections else "") + "."
    set_id = p.get("set_id")
    url = f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={set_id}" if set_id else f"https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22{generic}%22"
    return Evidence(id=evidence_id("openfda", c.key, "label", c.published), source_provider="openfda", source_record_id=c.key, evidence_kind="label",
                    transport=c.transport, tool_name=_tool_name(c), supplements=_supplements(attempts, SAFETY_SUPPLEMENTS), statement=statement,
                    source_name=f"FDA label ({brand}), {c.published[:4]}", source_url=url, publication_date=c.published, date_confidence=_confidence(c.date_basis),
                    date_basis=c.date_basis, study_type="label", controlled=False, population="human", outcome="na", relevance=rel, safety=facts,
                    independence_group="fda|", ledger_step=step, first_author="FDA", journal=f"{brand} prescribing information", year=int(c.published[:4]), group="FDA")


def _names_indication(signal: str, indication: str | None) -> bool:
    """A FAERS term that is the approved indication itself (e.g. "chronic myeloid leukaemia") is confounding by indication, not a side effect."""
    if not indication:
        return False
    norm = lambda s: s.lower().replace("leukaemia", "leukemia").replace("anaemia", "anemia").replace("tumour", "tumor")  # noqa: E731
    return norm(signal) in norm(indication)


def _strip_header(text: str | None) -> str | None:
    if not text:
        return None
    import re
    return re.sub(r"^\s*(?:\d+\s+)?CONTRAINDICATIONS\s*[:.-]?\s*", "", text, count=1, flags=re.I)


def outcome_for_trial(nct_id: str, publications: list[Evidence]) -> str | None:
    """A results record carries its outcome only from a matched primary publication (§17): the NCT id in the
    statement/verbatim text, and a controlled, blinded design."""
    for e in publications:
        blob = " ".join([e.statement] + [r.statement + " " + (r.verbatim_sentence or "") for r in e.relevance]).upper()
        if nct_id.upper() in blob and e.outcome in ("positive", "negative", "mixed") and (e.controlled and e.blinded):
            return e.outcome
    return None
