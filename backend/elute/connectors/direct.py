"""The direct public APIs as recorded fallbacks (BACKEND_PLAN §9a path A, §11). Each call takes the SAME tool name
and arguments as the ToolUniverse tool and returns a payload in the SAME shape, so `records.records_for` applies
unchanged and the historical backtest holds whichever transport delivered a record (stop conditions 27–28).

Also home to the two recorded supplements no ToolUniverse tool provides:
  * ClinicalTrials.gov v2 `designModule` / `statusModule` per NCT (masking, allocation, first-posted dates, results date);
  * Europe PMC `firstPublicationDate` per PMID (the day-level literature date).
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from elute.connectors.base import CacheMiss, ToolError
from elute.store import PayloadCache

TRANSPORT = "direct"
OPEN_TARGETS_GRAPHQL = "https://api.platform.opentargets.org/api/v4/graphql"
CLINICAL_TRIALS_V2 = "https://clinicaltrials.gov/api/v2/studies"
EUROPE_PMC_SEARCH = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
OPENFDA_LABEL = "https://api.fda.gov/drug/label.json"
LABEL_SECTION_CAP = 6000  # characters kept per label section; the highlights that name every warning come first

# The direct endpoint behind each ToolUniverse tool, as printed on the trace.
DIRECT_NAMES = {
    "OpenTargets_get_drug_chembId_by_generic_name": "opentargets.graphql:search",
    "OpenTargets_get_disease_id_description_by_name": "opentargets.graphql:search",
    "OpenTargets_get_target_id_description_by_name": "opentargets.graphql:search",
    "OpenTargets_get_drug_mechanisms_of_action_by_chemblId": "opentargets.graphql:drug.mechanismsOfAction",
    "OpenTargets_get_evidence_by_datasource": "opentargets.graphql:disease.evidences",
    "ClinicalTrials_search_studies": "clinicaltrials.gov/api/v2/studies",
    "PubMed_search_articles": "europepmc.rest:search",
    "PubMed_get_article": "europepmc.rest:search(EXT_ID)",
    "ctgov.study_design": "clinicaltrials.gov/api/v2/studies/{nct}",
    "europepmc.dates": "europepmc.rest:search(EXT_ID)",
    "FDA_get_boxed_warning_info_by_drug_name": "api.fda.gov/drug/label.json",
    "openfda.label": "api.fda.gov/drug/label.json",
    "OpenTargets_get_drug_warnings_by_chemblId": "opentargets.graphql:drug.drugWarnings",
    "OpenTargets_get_drug_adverse_events_by_chemblId": "opentargets.graphql:drug.adverseEvents",
}


class DirectConnector:
    def __init__(self, cache: PayloadCache | None = None, *, timeout_s: float = 20.0, offline: bool = False):
        self.cache = cache
        self.offline = offline or bool(cache and cache.offline)
        self.client = httpx.Client(timeout=timeout_s, headers={"User-Agent": "elute/0.1 (HackMIT 2026; drug-repurposing appraisal)"})

    # -- dispatch ----------------------------------------------------------
    def call(self, tool: str, arguments: dict[str, Any]) -> tuple[Any, int, bool]:
        fn = getattr(self, _DISPATCH.get(tool, ""), None)
        if fn is None:
            raise ToolError(f"no direct fallback for {tool}", kind="not-in-list")
        if self.cache is not None:
            cached = self.cache.get(TRANSPORT, tool, arguments)
            if cached is not None:
                return cached, 0, True
        if self.offline:
            raise CacheMiss(f"offline and {tool} not cached")
        t0 = time.monotonic()
        try:
            payload = fn(**arguments)
        except httpx.HTTPError as e:
            raise ToolError(f"{DIRECT_NAMES.get(tool, tool)}: {type(e).__name__}: {e}", retriable=True) from e
        except (ValueError, KeyError, TypeError, AttributeError) as e:
            # A body that is not the JSON shape the mapper expects (an HTML error page, a list where a dict was
            # due) is a failed call, never a failed run: the step degrades to zero records like any other error.
            raise ToolError(f"{DIRECT_NAMES.get(tool, tool)}: unreadable response: {type(e).__name__}: {e}", retriable=True) from e
        elapsed = int((time.monotonic() - t0) * 1000)
        if self.cache is not None:
            self.cache.put(TRANSPORT, tool, arguments, payload)
        return payload, elapsed, False

    # -- Open Targets ------------------------------------------------------
    def _gql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        r = self.client.post(OPEN_TARGETS_GRAPHQL, json={"query": query, "variables": variables})
        r.raise_for_status()
        body = r.json()
        if body.get("errors"):
            raise ToolError(f"Open Targets GraphQL: {body['errors'][0].get('message')}")
        return {"status": "success", "data": body.get("data")}

    def _search(self, q: str, entity: str) -> dict[str, Any]:
        return self._gql("query S($q:String!,$e:[String!]){search(queryString:$q,entityNames:$e){hits{id name description}}}",
                         {"q": q, "e": [entity]})

    def _OpenTargets_get_drug_chembId_by_generic_name(self, drugName: str) -> dict[str, Any]:
        return self._search(drugName, "drug")

    def _OpenTargets_get_disease_id_description_by_name(self, diseaseName: str) -> dict[str, Any]:
        return self._search(diseaseName, "disease")

    def _OpenTargets_get_target_id_description_by_name(self, targetName: str) -> dict[str, Any]:
        return self._search(targetName, "target")

    def _OpenTargets_get_drug_mechanisms_of_action_by_chemblId(self, chemblId: str) -> dict[str, Any]:
        return self._gql("""query M($id:String!){drug(chemblId:$id){id name mechanismsOfAction{rows{
            mechanismOfAction actionType targetName targets{id approvedSymbol} references{source urls}}}}}""", {"id": chemblId})

    def _OpenTargets_get_evidence_by_datasource(self, efoId: str | None = None, ensemblId: str | None = None,
                                                 datasourceIds: list[str] | None = None, size: int = 50, **_: Any) -> dict[str, Any]:
        if not efoId or not ensemblId:
            raise ToolError("direct evidence lookup needs efoId and ensemblId")
        return self._gql("""query E($efo:String!,$ens:[String!]!,$ds:[String!],$size:Int!){disease(efoId:$efo){id name
            evidences(ensemblIds:$ens,datasourceIds:$ds,size:$size){count rows{datasourceId datatypeId score resourceScore literature
            disease{id name} target{id approvedSymbol} urls{url niceName}}}}}""",
                         {"efo": efoId, "ens": [ensemblId], "ds": datasourceIds, "size": size})

    # -- ClinicalTrials.gov v2 ----------------------------------------------
    def _ClinicalTrials_search_studies(self, query_cond: str | None = None, query_intr: str | None = None,
                                       query_term: str | None = None, filter_status: str | None = None,
                                       filter_phase: str | None = None, page_size: int = 50, **_: Any) -> dict[str, Any]:
        params: dict[str, Any] = {"format": "json", "pageSize": page_size,
                                  "fields": "NCTId,BriefTitle,OverallStatus,StudyType,Phase,EnrollmentCount,Condition,InterventionName,LeadSponsorName,StartDate,CompletionDate"}
        if query_cond:
            params["query.cond"] = query_cond
        if query_intr:
            params["query.intr"] = query_intr
        if query_term:
            params["query.term"] = query_term
        if filter_status:
            params["filter.overallStatus"] = filter_status
        if filter_phase:
            params["filter.phase"] = filter_phase
        r = self.client.get(CLINICAL_TRIALS_V2, params=params)
        r.raise_for_status()
        body = r.json()
        studies = []
        for s in body.get("studies", []):
            p = s.get("protocolSection", {})
            ident, status, design = p.get("identificationModule", {}), p.get("statusModule", {}), p.get("designModule", {})
            studies.append({
                "nct_id": ident.get("nctId"), "brief_title": ident.get("briefTitle"), "status": status.get("overallStatus"),
                "study_type": design.get("studyType"), "phases": design.get("phases", []),
                "enrollment": (design.get("enrollmentInfo") or {}).get("count"),
                "conditions": (p.get("conditionsModule") or {}).get("conditions", []),
                "interventions": [i.get("name") for i in (p.get("armsInterventionsModule") or {}).get("interventions", [])],
                "sponsor": ((p.get("sponsorCollaboratorsModule") or {}).get("leadSponsor") or {}).get("name"),
                "start_date": (status.get("startDateStruct") or {}).get("date"),
                "completion_date": (status.get("completionDateStruct") or {}).get("date"),
            })
        return {"status": "success", "data": {"studies": studies, "total_count": body.get("totalCount"),
                                              "next_page_token": body.get("nextPageToken"),
                                              "executed_query": {k: v for k, v in params.items() if k.startswith("query.")}}}

    def _ctgov_study_design(self, nct_id: str) -> dict[str, Any]:
        r = self.client.get(f"{CLINICAL_TRIALS_V2}/{nct_id}", params={"format": "json",
                            "fields": "protocolSection.identificationModule,protocolSection.designModule,protocolSection.statusModule,hasResults"})
        r.raise_for_status()
        d = r.json()
        p = d.get("protocolSection", {})
        status, design = p.get("statusModule", {}), p.get("designModule", {})
        info = design.get("designInfo") or {}
        return {"nct_id": nct_id, "has_results": bool(d.get("hasResults")),
                "official_title": (p.get("identificationModule") or {}).get("officialTitle"),
                "allocation": info.get("allocation"), "masking": (info.get("maskingInfo") or {}).get("masking"),
                "who_masked": (info.get("maskingInfo") or {}).get("whoMasked", []),
                "enrollment": (design.get("enrollmentInfo") or {}).get("count"), "phases": design.get("phases", []),
                "study_first_post_date": (status.get("studyFirstPostDateStruct") or {}).get("date"),
                "start_date": (status.get("startDateStruct") or {}).get("date"),
                "primary_completion_date": (status.get("primaryCompletionDateStruct") or {}).get("date"),
                "results_first_post_date": (status.get("resultsFirstPostDateStruct") or {}).get("date"),
                "overall_status": status.get("overallStatus")}

    # -- Europe PMC ------------------------------------------------------------
    def _epmc(self, query: str, page_size: int) -> list[dict[str, Any]]:
        r = self.client.get(EUROPE_PMC_SEARCH, params={"query": query, "format": "json", "resultType": "core", "pageSize": min(page_size, 1000)})
        r.raise_for_status()
        return (r.json().get("resultList") or {}).get("result") or []

    @staticmethod
    def _epmc_to_pubmed_shape(x: dict[str, Any]) -> dict[str, Any]:
        """Europe PMC core result → the PubMed_search_articles hit shape. `pub_date` = firstPublicationDate (day-level)."""
        pmid = x.get("pmid") or (x.get("id") if x.get("source") == "MED" else None)
        return {"pmid": pmid, "title": x.get("title"), "abstract": x.get("abstractText"),
                "authors": [{"name": a.get("fullName")} for a in ((x.get("authorList") or {}).get("author") or [])][:5],
                "journal": ((x.get("journalInfo") or {}).get("journal") or {}).get("title") or x.get("journalTitle"),
                "pub_date": x.get("firstPublicationDate"), "pub_year": x.get("pubYear"), "doi": x.get("doi"),
                "pmcid": x.get("pmcid"), "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else f"https://europepmc.org/abstract/{x.get('source')}/{x.get('id')}",
                "europepmc_id": x.get("id"), "europepmc_source": x.get("source"), "cited_by_count": x.get("citedByCount")}

    def _PubMed_search_articles(self, query: str, limit: int = 50, **_: Any) -> dict[str, Any]:
        hits = [h for h in (self._epmc_to_pubmed_shape(x) for x in self._epmc(f"({query}) AND SRC:MED", limit)) if h["pmid"]]
        return {"status": "success", "data": hits, "metadata": {"count": len(hits), "query": query, "source": "Europe PMC (direct)"}}

    def _PubMed_get_article(self, pmid: str, **_: Any) -> dict[str, Any]:
        ids = [p.strip() for p in str(pmid).split(",") if p.strip()]
        hits = [self._epmc_to_pubmed_shape(x) for x in self._epmc("(" + " OR ".join(f"EXT_ID:{p}" for p in ids) + ") AND SRC:MED", len(ids) + 10)]
        return {"status": "success", "data": hits}

    # -- openFDA (the label) -------------------------------------------------
    def _openfda_labels(self, drug_name: str) -> list[dict[str, Any]]:
        """Every product label for the name, trimmed to the sections the appraisal reads. A 404 is "no label", not an error."""
        q = f'openfda.generic_name:"{drug_name}" OR openfda.brand_name:"{drug_name}"'
        r = self.client.get(OPENFDA_LABEL, params={"search": q, "limit": 25})
        if r.status_code == 404:
            return []
        r.raise_for_status()
        out = []
        for row in r.json().get("results", []):
            o = row.get("openfda") or {}
            first = lambda k: ((row.get(k) or [None])[0] or None)  # noqa: E731
            cut = lambda s: (s[:LABEL_SECTION_CAP] if isinstance(s, str) else None)  # noqa: E731
            out.append({"set_id": row.get("set_id"), "id": row.get("id"), "version": row.get("version"), "effective_time": row.get("effective_time"),
                        "brand_name": (o.get("brand_name") or [None])[0], "generic_name": (o.get("generic_name") or [None])[0],
                        "application_number": (o.get("application_number") or [None])[0], "manufacturer": (o.get("manufacturer_name") or [None])[0],
                        "boxed_warning": cut(first("boxed_warning")), "warnings_and_cautions": cut(first("warnings_and_cautions")),
                        "warnings": cut(first("warnings")), "precautions": cut(first("precautions")),
                        "contraindications": cut(first("contraindications")), "indications_and_usage": cut(first("indications_and_usage"))})
        return out

    def _FDA_get_boxed_warning_info_by_drug_name(self, drug_name: str, limit: int = 25, **_: Any) -> dict[str, Any]:
        """The ToolUniverse row shape: openfda names plus the boxed warning; the related warnings section when there is none."""
        rows = []
        for lab in self._openfda_labels(drug_name)[:limit]:
            row: dict[str, Any] = {"openfda.brand_name": [lab["brand_name"]] if lab["brand_name"] else None,
                                   "openfda.generic_name": [lab["generic_name"]] if lab["generic_name"] else None,
                                   "boxed_warning": [lab["boxed_warning"]] if lab["boxed_warning"] else None}
            if not lab["boxed_warning"]:
                related = [k for k in ("warnings_and_cautions", "warnings", "precautions") if lab.get(k)]
                for k in related:
                    row[k] = [lab[k]]
                if related:
                    row["related_sections_present"] = related
            rows.append(row)
        return {"meta": {"skip": 0, "limit": limit, "total": len(rows)}, "results": rows, "result_count": len(rows)}

    def _openfda_label(self, drug_name: str) -> dict[str, Any]:
        """The recorded supplement: every label with its set id, version, effective_time, application number and sections."""
        return {"labels": self._openfda_labels(drug_name)}

    def _OpenTargets_get_drug_warnings_by_chemblId(self, chemblId: str) -> dict[str, Any]:
        return self._gql("""query W($id:String!){drug(chemblId:$id){id name drugWarnings{warningType description country year
            toxicityClass chemblIds efoIdForWarningClass references{id source url}}}}""", {"id": chemblId})

    def _OpenTargets_get_drug_adverse_events_by_chemblId(self, chemblId: str, page: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._gql("""query A($id:String!,$page:Pagination){drug(chemblId:$id){id name adverseEvents(page:$page){count criticalValue
            rows{name meddraCode count logLR}}}}""", {"id": chemblId, "page": page})

    def _europepmc_dates(self, pmids: list[str]) -> dict[str, Any]:
        """{pmid: {"first_publication_date", "cited_by_count"}} — the day-level date (§9.2) and the §11.4 ranking key."""
        out: dict[str, dict[str, Any]] = {}
        for i in range(0, len(pmids), 50):
            chunk = pmids[i:i + 50]
            for x in self._epmc("(" + " OR ".join(f"EXT_ID:{p}" for p in chunk) + ") AND SRC:MED", len(chunk) + 10):
                if x.get("pmid") and x.get("firstPublicationDate"):
                    out[str(x["pmid"])] = {"first_publication_date": x["firstPublicationDate"], "cited_by_count": x.get("citedByCount")}
        return out



# tool name → method; the supplements use their trace names.
_DISPATCH = {name: "_" + name for name in DIRECT_NAMES if not name.startswith(("ctgov.", "europepmc.", "openfda."))}
_DISPATCH["ctgov.study_design"] = "_ctgov_study_design"
_DISPATCH["europepmc.dates"] = "_europepmc_dates"
_DISPATCH["openfda.label"] = "_openfda_label"
