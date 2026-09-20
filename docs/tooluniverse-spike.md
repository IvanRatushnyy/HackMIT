# ToolUniverse spike — implementation contract

**Status:** verified 2026-09-20 (spike); written up at M0B per `docs/BACKEND_PLAN.md` v4.4 §20. Every fact here was read from the installed package's tool registry (`src/tooluniverse/data/*.json`) or observed in a live call whose payload is committed under `backend/tests/fixtures/payloads/`. Nothing is paraphrased from memory.

## Install and initialization

| | |
|---|---|
| Package | `tooluniverse==1.5.0` (PyPI, released 2026-09-16); pinned in `backend/pyproject.toml` and `backend/uv.lock` |
| Python | ≥ 3.10 required by the package; Elute uses 3.12 |
| Install | `cd backend && uv sync --extra dev` |
| Initialization (exact) | `from tooluniverse import ToolUniverse; tu = ToolUniverse(); tu.load_tools(include_tools=[...the eleven names...])` — never `load_tools()` without a list: the full catalogue is ~2,900 tools |
| Call (exact) | `tu.run({"name": "<tool>", "arguments": {...}})` → the tool's payload (a `dict`, usually `{"status": "success", "data": ...}`) |
| Errors | returned, not raised: `{"status": "error", "error": "<message>", "error_details": {"type": "<kind>", "retriable": <bool>}}`. `elute/connectors/tooluniverse.py` converts this envelope, exceptions and timeouts into `ToolError` so the bounded loop records the attempt and falls back (path A). |
| Timeouts | none built in; Elute runs each call on a thread pool with a 25 s timeout (`ToolUniverseConnector(timeout_s=25)`) |
| Settings / environment | none required. `NCBI_API_KEY` optional (PubMed tools: 3 req/s without, 10/s with). No other key or config. |
| Loaded in Elute | exactly the eleven names in `elute/connectors/tooluniverse.py::TOOL_NAMES` |

Verified live for nilotinib `CHEMBL255863` / Parkinson disease `MONDO_0005180` / ABL1 `ENSG00000097007` on 2026-09-20; payloads recorded under `backend/tests/fixtures/payloads/tooluniverse/<tool name>/<sha>.json` (and the direct fallbacks under `…/direct/`), replayed by `backend/tests/test_tooluniverse_tools.py`.

## The sponsor-compliance three

Three distinct real ToolUniverse tools, each executed successfully and contributing Evidence to the hero appraisal. Direct API fallbacks and the two recorded direct supplements do **not** count toward this three.

| # | Category | Exact tool name | `source_provider` |
|---|---|---|---|
| 1 | biology / target evidence | `OpenTargets_get_drug_mechanisms_of_action_by_chemblId` | `open_targets` |
| 2 | clinical trials | `ClinicalTrials_search_studies` | `clinicaltrials_gov` |
| 3 | biomedical literature | `PubMed_search_articles` | `pubmed` |

## Per-tool contract

Registry description = the tool's own `description` field, truncated where long. Result shape = what the recorded payload contains. Normalizer = the mapper in `elute/connectors/records.py` (shared by both transports).

### `OpenTargets_get_drug_chembId_by_generic_name` — L1 resolve
- Registry: *"Fetch the drug chemblId and description based on the drug generic name."* Type `OpentargetToolDrugNameMatch`.
- Call: `{"drugName": "nilotinib"}` (required: `drugName`).
- Result: `{"status": "success", "data": {"search": {"hits": [{"id": "CHEMBL255863", "name": "NILOTINIB", "description": ...}]}}}`.
- Example / cassette: `payloads/tooluniverse/OpenTargets_get_drug_chembId_by_generic_name/`.
- Provider: Open Targets Platform. Normalizer: `entity_records` (kind `entity`, undated — identifiers are not evidence).
- Direct fallback: Open Targets GraphQL `search(queryString, entityNames:["drug"])`.

### `OpenTargets_get_disease_id_description_by_name` — L1 resolve
- Registry: *"Retrieve the efoId and additional details of a disease based on its name."*
- Call: `{"diseaseName": "Parkinson disease"}`. Result: `data.search.hits[]{id: "MONDO_0005180", name: "Parkinson disease", description}`.
- Cassette: `payloads/tooluniverse/OpenTargets_get_disease_id_description_by_name/`. Normalizer: `entity_records`. Fallback: GraphQL search, entity `disease`.

### `OpenTargets_get_target_id_description_by_name` — L1 resolve
- Registry: *"Get the ensemblId and description based on the target name."*
- Call: `{"targetName": "ABL1"}`. Result: `data.search.hits[]{id: "ENSG00000097007", name: "ABL1", description}`.
- Cassette: `payloads/tooluniverse/OpenTargets_get_target_id_description_by_name/`. Normalizer: `entity_records`. Fallback: GraphQL search, entity `target`.

### `OpenTargets_get_drug_mechanisms_of_action_by_chemblId` — **L2 biology (tool #1)**
- Registry: *"Retrieve the mechanisms of action associated with a specific drug using chemblId."*
- Call: `{"chemblId": "CHEMBL255863"}` (required: `chemblId`).
- Result: `data.drug{id, name, mechanismsOfAction{rows[]{mechanismOfAction, actionType, targetName, targets[]{id, approvedSymbol}, references[]{source, urls[]}}}}`. For nilotinib the ABL1 row is `actionType: "INHIBITOR"`, referenced to the FDA label / DailyMed, not a PMID.
- Date rule: the label year in the FDA URL → last day of that year (`2010-12-31`); no dated reference → undated → never Evidence.
- Cassette: `payloads/tooluniverse/OpenTargets_get_drug_mechanisms_of_action_by_chemblId/f9f2e81e946e6701bdfc.json`.
- Provider: Open Targets (ChEMBL-curated). Normalizer: `mechanism_records` (kind `mechanism`). Fallback: GraphQL `drug(chemblId){mechanismsOfAction{rows{...}}}`.

### `OpenTargets_get_evidence_by_datasource` — L2 biology (sibling)
- Registry: *"Get target-disease evidence from Open Targets filtered by configurable data sources … accepts any datasourceIds (gwas_credible_sets, eva, eva_somatic, gene_burden, genomics_england, intogen, …)."*
- Call: `{"efoId": "MONDO_0005180", "ensemblId": "ENSG00000097007", "size": 50}` (optional `datasourceIds[]`, `gene_symbol`, `disease_name`).
- Result: `data.disease{id, name, evidences{count, rows[]{datasourceId, datatypeId, score, resourceScore, literature[] (PMIDs), target{id, approvedSymbol}, disease{id, name}, urls[]{url, niceName}}}}`. For ABL1 × Parkinson every row is a `europepmc` literature row with one PMID.
- Date rule: the row's PMID, dated by the literature date rule (Europe PMC `firstPublicationDate` supplement); a row without a PMID stays undated.
- Cassette: `payloads/tooluniverse/OpenTargets_get_evidence_by_datasource/`. Normalizer: `association_records` (kind `association`). Fallback: GraphQL `disease(efoId){evidences(ensemblIds, datasourceIds, size){rows{...}}}`.

### `ClinicalTrials_search_studies` — **L3 trials (tool #2)**
- Registry: *"Search ClinicalTrials.gov for clinical trial studies by condition, intervention, sponsor, or other criteria. Returns NCT IDs, titles, status, phase, enrollment, and key trial metadata … Query rewriting: multi-word interventions/conditions wrapped in parentheses are sent verbatim."* Type `ClinicalTrialsTool`.
- Call: `{"query_cond": "(Parkinson disease)", "query_intr": "(nilotinib)", "page_size": 100}`; optional `query_term`, `filter_status`, `filter_phase`, `filter_study_type`, `next_page_token` (`page_size ≤ 1000`).
- Result: `{"status": "success", "data": {"studies": [{nct_id, brief_title, status, study_type, phases[], enrollment, conditions[], interventions[], sponsor, start_date, completion_date}], "total_count", "next_page_token", "executed_query"}, "metadata": {...}}`.
- **Does not return** masking, allocation, `studyFirstPostDate`, `hasResults` or `resultsFirstPostDate`. Elute records one direct ClinicalTrials.gov v2 call per NCT (`ctgov.study_design`, `transport = direct`) as a supplement: it dates the registration record by `studyFirstPostDate` and creates the separate results record dated by `resultsFirstPostDate`.
- Registry facts established: NILO-PD is **NCT03205488** (Northwestern; n = 76; triple-masked; first posted 2017-07-02; started 2017-10-16; results posted 2020-07-22). The Georgetown phase 2 is **NCT02954978** (n = 75; quadruple-masked; first posted 2016-11-04; results posted 2026-06-12). The Georgetown open-label pilot is NCT02281474 (n = 12; masking NONE; no results posted).
- Cassettes: `payloads/tooluniverse/ClinicalTrials_search_studies/` (canonical and reformulated queries); supplements under `payloads/direct/ctgov.study_design/`.
- Provider: ClinicalTrials.gov. Normalizer: `trial_records` (kind `trial-registration`; `enrich.trial_design` adds `trial-results`). Fallback: ClinicalTrials.gov v2 `/studies` with the same arguments, flattened to the same shape.
- Query rule: the condition goes in parentheses, unquoted, so the registry's synonym expansion applies; the reformulation ORs the aliases.

### `get_clinical_trial_status_and_dates` · `get_clinical_trial_conditions_and_interventions` · `extract_clinical_trial_outcomes` — L3 siblings
- Registry: per-NCT detail tools (`ClinicalTrialsDetailsTool`), required `nct_ids[]`: status + start/completion dates; conditions, interventions and arm groups; outcome results (e.g. survival months, p-values).
- Loaded and verified; used for per-NCT detail when the search row is insufficient. They do not return masking or posted dates either, so the `ctgov.study_design` supplement stays.

### `PubMed_search_articles` — **L4 literature (tool #3)**
- Registry: *"Search PubMed biomedical literature database using NCBI E-utilities (esearch + esummary). Returns articles with PMID, title, authors, journal, publication year, DOI, article type, and PubMed URL. Automatically fetches rich metadata for each article."* Type `PubMedRESTTool`.
- Call: `{"query": "<PubMed query>", "limit": 100, "include_abstract": false}` (required: `query`; `limit ≤ 200`; optional `mindate`, `maxdate`, `datetype`, `sort`). **Elute searches with `include_abstract: false`** (metadata only) and fetches abstracts separately for the selected visible PMIDs (§9.1 of the plan). The spike's cassettes were recorded with `include_abstract: true`; M3 re-records.
- Result: `{"status": "success", "data": [{pmid, title, abstract?, authors[]{name}, journal, pub_date (prose: "2016 Jul 11" / "2014"), pub_year, doi, pmcid, url}], "metadata": {count, query, ...}}`.
- Date rule: PubMed `pub_date` is prose and sometimes year-only; the record's date is the earliest day-level date among PubMed `pub_date` and Europe PMC `firstPublicationDate` (one batched direct supplement per step, `europepmc.dates`); a month- or year-only date resolves to the last day of its period. Verified: Pagan 2016 → 2016-07-01; Reinwald 2014 → 2014-06-15; the MAO-B commentary (PMID 28035939) → 2017-01-01; Simuni 2021 → 2021-03-01.
- Query rule: the disease name **unquoted** in parentheses reaches PubMed's MeSH mapping (`(Parkinson disease)`); quoted it does not. The *alternative explanation* facet is empty on the first query and found on the reformulated one (the commentary is indexed under *Parkinsonian*) — the natural path-B correction.
- Cassettes: `payloads/tooluniverse/PubMed_search_articles/` (eight facets, canonical and reformulated); supplements under `payloads/direct/europepmc.dates/`.
- Provider: PubMed (NCBI). Normalizer: `article_records` (kind `article`). Fallback: Europe PMC REST search restricted to `SRC:MED`, mapped to the same hit shape (`connectors/direct.py::_PubMed_search_articles`).

### `PubMed_get_article` — L4 literature (sibling)
- Registry: *"Get complete metadata for a specific PubMed article by its PMID using efetch. Returns … full abstract, complete author list with affiliations, journal details, publication dates, DOI, MeSH terms, article type …"*
- Call: `{"pmid": "27434297,25025064"}` (required: `pmid`, string or integer; comma-separated batches work).
- Result: the same hit shape as the search tool plus `mesh_terms[]`, `publication_types[]`, and author affiliations.
- Role in Elute: the abstract fetch for the selected visible PMIDs only (never before the temporal gate), and the source of author affiliations for the §10 independence-group proxy. **No cassette yet** — recorded in M3 when the abstract-fetch step is wired. Fallback: Europe PMC `EXT_ID:` lookup (`_PubMed_get_article`).

## Recorded direct supplements (transport `direct`; never counted toward the three)

| Name | Endpoint | Why | Cassettes |
|---|---|---|---|
| `ctgov.study_design` | `https://clinicaltrials.gov/api/v2/studies/{nct}` (designModule, statusModule, hasResults) | masking, allocation, first-posted and results-posted dates the ToolUniverse trials tools do not return | `payloads/direct/ctgov.study_design/` |
| `europepmc.dates` | `https://www.ebi.ac.uk/europepmc/webservices/rest/search` (`EXT_ID:` batch, `SRC:MED`) | day-level `firstPublicationDate` per PMID | `payloads/direct/europepmc.dates/` |

## Direct fallbacks (transport `direct`; same tool names, same payload shapes)

`elute/connectors/direct.py::DIRECT_NAMES` maps every ToolUniverse tool above to its public endpoint: Open Targets GraphQL (`api.platform.opentargets.org/api/v4/graphql`), ClinicalTrials.gov v2 (`clinicaltrials.gov/api/v2/studies`), Europe PMC REST (`ebi.ac.uk/europepmc/webservices/rest/search`). `records.records_for` applies unchanged, so a record is identical whichever transport delivered it (`test_direct_fallback_produces_the_same_record_shape`).

## What the spike did not find

- No ToolUniverse tool returns trial masking or posted dates (hence the `ctgov.study_design` supplement).
- `EuropePMC_search_articles` in ToolUniverse returns only `year`, so PubMed is the literature tool and Europe PMC the date supplement.
- `OPENALEX_API_KEY` is required for Phase 2's OpenAlex tools (anonymous requests return 503 since 2026-02-13). Not a Phase 1 concern.
