# Elute — backend plan

**Status:** v4.4 FINAL, Sept 20 2026. v4 (approved) set the architecture; v4.1 (approved) added ToolUniverse and the reasoning trace as Phase 1 requirements; v4.2 (approved) was the engineering-specification pass; v4.3 (approved) absorbed the completed ToolUniverse spike (§20). **v4.4 resolves the final temporal-step, trial-identity, current-snapshot, and existing-code consistency issues. No architectural changes from v4.3.**
**Read first:** `CLAUDE.md` → `PRD Elute.md` §2, §3, §5 → `docs/sponsor-conversations.md` → `src/data/types.ts`, `src/lib/evidence.ts`, `src/fixtures/nilotinib.ts`.
**Implementation status (Sept 20, end of day):** M0A ✓ · spike ✓ · M0B ✓ · M1 ✓ · M2 ✓ · M3 ✓ · M4 ✓ (client, extraction, synthesis, gate; OpenAI cassettes recorded by `scripts/record_llm.py`, which refuses to record a snapshot with zero extraction calls) · M5 ✓ · M6 ✓ (adapter output passes the frontend's own validator via `scripts/validate-detail.ts`) · M7 ✓ on the fixture bundle at the three pinned dates and on live cassettes for every presence/absence assertion that does not need extraction; the claim-status assertions on live cassettes run in `tests/test_golden_live_replay.py`, which must execute, not skip. Literature cassettes are recorded through the real live selection path (`scripts/record_literature.py` runs `LiveRun`, since `PubMed_get_article` cassettes are keyed by the exact PMID batch) and OpenAI cassettes only after extraction is confirmed. 91 backend tests + 37 frontend tests green. A cold-start live run through the API completed in 17 s with the three ToolUniverse tools and one natural path-B correction.

**Implementation notes that refine, not change, this plan:** (1) at `PRE_TRIAL_SNAPSHOT` the approved weakest-link policy names `C_DOWNSTREAM`, not `C_EXPOSURE`: both are contested with one contradicting source each, and C_DOWNSTREAM's support (two mouse studies plus the pilot's biomarker finding) carries one more caveat than C_EXPOSURE's (the pilot alone); the golden test records the engine's answer per §17, `next_question.gate` stays `C_EXPOSURE`. (2) Literature retrieval asks each facet for up to 100 metadata records (as the spike proved necessary for the backtest papers to appear) and applies `MAX_RESULTS_PER_FACET = 5` / `MAX_UNIQUE_PAPERS_AFTER_DEDUP = 20` after the temporal gate, charging each record to its primary facet; the rank key puts a deterministic title-relevance term (drug, disease, facet terms in the title) ahead of `citedByCount`, because citation volume alone surfaced broad reviews over the specific PK measurement. (3) `citedByCount` comes from the Europe PMC date supplement (same call), since the ToolUniverse PubMed tool does not return it. (4) Trial results records carry an outcome only when a matched primary publication names the NCT id; otherwise `na` with no link.

**Naming invariant:** the product is **Elute** (code: `elute`). No user-facing string, doc, or code symbol uses the earlier working name; it survives only in `PRD.md`, the superseded historical copy.
**Rule:** implementation proceeds milestone by milestone (§22), tests green after each. Phase 2 does not start until every Phase 1 stop condition is met and reviewed.

**One authoritative statement per scope decision** (repeated nowhere else in a contradicting form):

- The only live scientific case in Phase 1 is **nilotinib + Parkinson's disease**.
- **ToolUniverse — two separate requirements.** *Product runtime:* Elute must still function if ToolUniverse fails; direct public APIs (Open Targets GraphQL, ClinicalTrials.gov v2, NCBI/Europe PMC) are runtime fallbacks answering the same tool names. *Sponsor compliance:* to claim the Regeneron *Agentic Clinical AI Orchestrator* requirement, **three distinct real ToolUniverse tools must successfully execute and contribute to the hero appraisal**; direct APIs never count toward that three. The spike (§20) verified three: `OpenTargets_get_drug_mechanisms_of_action_by_chemblId`, `ClinicalTrials_search_studies`, `PubMed_search_articles`. ToolUniverse is Phase 1, not deferred, not optional.
- **OpenAI is the only LLM.** No Anthropic SDK, key, or model anywhere.
- **Elute may hold an opinion**, always downstream of visible evidence, never forced, never with a fabricated number. (This amends PRD v2.2 §6/§7 and `CLAUDE.md` principle 5, which say "never recommends".)
- **The agent's thought process is a product feature**: a user-facing reasoning trace per step, generated as an explicit structured output (templated for deterministic steps, OpenAI for interpretive ones), never hidden model state.
- **Historical backtest** at three pinned dates is non-negotiable; no post-cutoff content ever reaches the model, the claims, the reasoning, or the user.
- **Phase 2 begins with OpenAlex** citation independence, informational only.

---

## 1. The architecture in thirty seconds

```
public biomedical sources      Open Targets · ClinicalTrials.gov · PubMed (+ Europe PMC and ClinicalTrials.gov v2 as recorded direct supplements for dates and design)
          ↓
ToolUniverse (preferred)       one verified ToolUniverse tool per task; the direct API answers the same tool name as the recorded fallback
          ↓
raw metadata (transport layer) cached on disk; may contain post-cutoff records; nothing downstream reads them directly
          ↓
canonicalize → combine → dedup one record per publication / trial / entity, stable id  (the literature order of §9.1, identical everywhere)
          ↓
authoritative date             each record gets its availability date (§9.2)
          ↓
temporal visibility gate       publication_date <= as_of — the single visibility boundary, applied inside the retrieval steps (L2/L3/L4) before any content is fetched or any model call is made
          ↓
rank → cap                     bounded retrieval; counts recorded in the trace
          ↓
fetch content                  abstract text only for the selected, visible records
          ↓
normalize to Evidence          one Evidence per source record; claim-level findings live in Evidence.relevance[]
          ↓
temporal audit (L6)            re-verifies every Evidence has publication_date <= as_of and writes the user-facing visibility summary; never a second filter — a leak here fails validation
          ↓
Claims + mechanism chain       seven fixed claims (C_MECHANISM … C_SAFETY); every claim resolves to Evidence or is `unknown`
          ↓
deterministic engine           claim status, weakest link, contradictions, unknowns, next question, recommendation stance — pure functions
          ↓
OpenAI, bounded                extraction from visible abstracts; L4 query refinement and interpretation; L9 synthesis; optional L10 wording — cited, schema-validated
          ↓
validation gate                uncited sentence, unmatched number, ignored contradiction, stance mismatch → reject, re-ask once, deterministic fallback
          ↓
CandidateAppraisal             evidence + claims + chain + case for/against + weakest link + next question + grounded opinion + reasoning trace
```

The evidence system is the source of truth. The LLM reads visible text and writes clear prose; it never decides what evidence exists, when it was published, what a claim's status is, or whether something falls before a cutoff.

---

# PHASE 1 — MUST WORK FOR JUDGING

## 2. Exact scope

**Input:** `{drug, disease, as_of?}`. **Output:** one `CandidateAppraisal`. Fixture mode returns the curated nilotinib appraisal with zero network and zero keys; live mode builds it through the three tasks and OpenAI. Both return the same schema and are produced by the same engine.

The appraisal answers, in order:

| The scientist's question | Where it is answered |
|---|---|
| Why might this work? | `strongest_case_for`, the mechanism chain |
| What assumptions does it depend on? | the seven Claims; `caveats` on Evidence |
| What supports / contradicts / qualifies each? | `Evidence.relevance[]` per Claim |
| Has it been tested clinically? Did trials fail? | ClinicalTrials.gov Evidence on `C_CLINICAL` |
| Does the drug reach the compartment? | `C_EXPOSURE` |
| Is target engagement demonstrated in humans? | `C_ENGAGEMENT` — separate from exposure |
| Does the downstream biology happen? | `C_DOWNSTREAM` — separate from both |
| Strongest argument against? Weakest link? | `strongest_case_against`, `weakest_link` |
| What next, why, how, what would change the appraisal? | `next_question` |
| Elute's current opinion? | `recommendation`, always downstream of the above |
| How did the agent get here? | `ledger[].reasoning` per step |

**In Phase 1:** the three tasks via ToolUniverse with direct fallbacks; OpenAI extraction, L4 refinement/interpretation, L9 synthesis; deterministic engine; three-date backtest; fixture/live parity; graceful degradation; bounded in-step self-correction; the frontend adapter. **Safety** is read at L2 (added Sept 20): the FDA label through `FDA_get_boxed_warning_info_by_drug_name` (openFDA behind it as the direct fallback), dated by the label version's `effective_time` via the recorded `openfda.label` supplement, with Open Targets' black-box classes and FAERS signals as undated enrichments; a boxed warning or a withdrawal `contradicts` `C_SAFETY`, warnings without a box `qualify` it, a clean label `supports` it. The adapter derives the Safety block and the fifth prerequisite (boxed → `conditional`, *with monitoring*) from that one record. At a cutoff before the label version's date the label is withheld and the page says the label read is dated later, never that nothing was read.

**Not in Phase 1:** §17 and §18.

## 3. Runtime, entry point, settings, dependencies

**Workflow: `uv`.** One workflow, no alternatives. Python 3.12.

```
cd backend
uv sync --extra dev                       # creates .venv from pyproject + uv.lock (dev extra = pytest, pytest-asyncio, respx)
uv run uvicorn elute.main:app --reload --port 8000
uv run pytest                             # all tests
```

`backend/pyproject.toml` already exists from the spike (`tooluniverse==1.5.0`, `httpx`, `pydantic`, dev extra `pytest`, `respx`; setuptools build; `pythonpath = ["."]`). M0A extends it to the full table below; no second project file, no other package manager.

`backend/pyproject.toml` (project `elute`, `requires-python = ">=3.12"`):

| Package | Minimum | Purpose |
|---|---|---|
| `fastapi` | 0.115 | API |
| `uvicorn[standard]` | 0.30 | server |
| `pydantic` | 2.8 | models |
| `pydantic-settings` | 2.4 | `settings.py` |
| `httpx` | 0.27 | direct connectors |
| `openai` | 1.66 | Responses API + structured outputs |
| `sse-starlette` | 2.1 | `/events` |
| `pytest` | 8.3 | tests |
| `pytest-asyncio` | 0.24 | async tests |
| `respx` | 0.21 | HTTP mocking |
| `tooluniverse` | `==1.5.0` (pinned; verified in the spike, §20) | the three tools; PyPI, Python ≥ 3.10; `NCBI_API_KEY` optional |

`uv.lock` is produced at **M0A** (provisional, all known dependencies — ToolUniverse's pin is already known from the spike) and confirmed **final at M0B** after `uv lock && uv sync --extra dev` and the bootstrap tests pass with ToolUniverse imported. Only the M0B lock is committed as final; the venue environment installs from it.

`elute/main.py`: creates the FastAPI app with prefix `/api`; includes `api/appraisals.py` and `api/health.py`; CORS for `http://localhost:5173` and the deployed frontend origin from `ELUTE_CORS_ORIGINS`; startup opens the SQLite store and loads fixtures; shutdown closes it.

`elute/settings.py` (`pydantic-settings`, reads `.env`):

```
OPENAI_API_KEY: str | None = None
OPENAI_MODEL: str | None = None            # required in live mode when a key is set; no default model id anywhere in code
ELUTE_MODE: Literal["fixture", "live"] = "fixture"
ELUTE_CACHE_DIR: Path = ".cache"
ELUTE_DB_PATH: Path = ".cache/elute.sqlite"
ELUTE_CORS_ORIGINS: str = "http://localhost:5173"   # comma-separated
ELUTE_DEMO_DISABLE_TOOL: str | None = None          # "biology" | "clinical_trials" | "literature"; transparent fault injection (§12)
NCBI_API_KEY: str | None = None                     # optional; PubMed tools run at 3 req/s without it, 10/s with it (spike finding)
# No other ToolUniverse setting is required (spike finding); OPENALEX_API_KEY joins in Phase 2 (anonymous OpenAlex returns 503 since 2026-02-13)
```

`.env.example` ships all keys with empty values; `.env` is gitignored; the key is never logged, echoed, or returned. `/health.llm_configured` is true only when a key and model are set and a one-token probe succeeded at startup (cached; not re-probed per request).

## 4. What OpenAI does (bounded, schema-validated, cited)

Responses API with structured outputs (`client.responses.parse`, Pydantic `text_format`). One `LLMClient` protocol with `complete_structured(schema, system, user) -> BaseModel`; implementations `OpenAIClient` and `NullClient` (no key → every call returns `None` and the caller degrades per §14).

| Where | Task | Input the model receives | Output schema | Validation |
|---|---|---|---|---|
| L4 | **Extraction**, one call per selected abstract | title + abstract (fetched only for selected visible records) + the seven claim ids with one-line definitions | `study_type`, `controlled`, `blinded`, `placebo`, `population`, `sample_size?`, `outcome?`, `pk_facts[]` `{value, unit, verbatim_sentence}`, `caveats[]` (closed vocabulary), `relevance[]` `{claim_id, direction, statement, verbatim_sentence?}`, `display_statement` | every number, caveat and relevance must carry a verbatim sentence found in the abstract (normalized whitespace); a relevance item without one is dropped; unknown fields stay null |
| L4 | **Query refinement**, when a facet's result is insufficient (§11) | the facet, the previous query, the insufficiency reason, the resolved entity names/ids | `query`, `reason` | ≤ 200 chars; entity name must appear |
| L4 | **Interpretation** for the step's reasoning | the step's question, the retrieval counts, the visible Evidence summaries (id, statement, date, design, n) and the engine's derived status changes | `AgentReasoning` (§7) | cites resolve; `what_this_changes` may only name statuses the engine derived |
| L9 | **Synthesis** | Claims with statuses, visible Evidence (id, statement, date, design, n, caveats), weakest link, contradictions, unknowns, the deterministic `stance` | `strongest_case_for[]`, `strongest_case_against[]` (`{text, cites[]}`), `opinion`, `what_would_change_my_mind` | §6 gate |
| L10 | **Wording** (optional) | the deterministic next-question block | `why_this_question_matters` | cites resolve; falls back to the template |

**Where OpenAI is not used:** L1 resolve, L2 biology, L3 trials, L5 normalize, L6 temporal audit, L7 claims, L8 engine, validation, and every `AgentReasoning` for those steps — all templated in code (§7). Tool selection is never an LLM decision (§11). The model never receives the unfiltered evidence set, publication dates to decide on, or a request for a number it was not given.

## 5. What the deterministic engine does (pure functions, tested)

- **Temporal visibility gate** (`pipeline/temporal.py::visible(records, as_of)`): the single visibility boundary, called inside L2, L3 and L4 on dated, deduplicated metadata records before any content fetch or model call (§9). **Temporal audit** (`pipeline/temporal.py::audit(evidence, as_of)`): run at L6 over the normalized Evidence; it does not filter, it asserts `publication_date <= as_of` for every Evidence, writes the visibility summary to the trace, and raises `ValidationError` on any leak.
- **Claim status** (`engine/labels.py`): a port of the six ordered rules in `src/lib/evidence.ts`, evaluated over the visible relevance links of a claim:

  | Status | Rule (first match wins) |
  |---|---|
  | `unknown` | no visible relevance links |
  | `refuted` | any `refutes` link (a `refutes` link requires `controlled=true, blinded=true, outcome=negative`; the normalizer downgrades anything else to `contradicts`) |
  | `contested` | any `contradicts` link |
  | `established` | ≥ 2 supporting links from **distinct independence groups** (§10), neither `unknown`, no overlapping key author; or any supporting `label`/`regulatory` source |
  | `single-source` | otherwise (supporting links from one group, or from groups that cannot be told apart) |

  Directions on a link: `supports`, `contradicts`, `refutes`, `qualifies`. `qualifies` counts as `supports` and attaches its caveats (e.g. *animal-model* → the qualifier *in mouse models*). Statuses are per claim: `C_CLINICAL` can be `refuted` while `C_MECHANISM` stays `established`.

- **Weakest link** (`engine/weakest_link.py`). Policy, encoded exactly:

  ```python
  WEAKNESS = {"established": 0, "single-source": 1, "unknown": 2, "contested": 3, "refuted": 4}
  CAUSAL_ORDER = ["C_MECHANISM", "C_DISEASE_RELEVANCE", "C_EXPOSURE", "C_ENGAGEMENT", "C_DOWNSTREAM", "C_CLINICAL", "C_SAFETY"]

  def weakest(claims):
      return max(claims, key=lambda c: (
          WEAKNESS[c.status],
          count_against(c),            # contradicts + refutes links
          len(c.caveats),
          -CAUSAL_ORDER.index(c.id),   # earlier in the causal chain wins a full tie
      ))
  ```

  Intended ordering: refuted is weaker than contested, weaker than unknown, weaker than single-source, weaker than established. **Why `unknown` is weaker than `single-source`:** one paper is a testable claim with a known design and n; no evidence at all is a hole the hypothesis silently steps over — Henry's "unknown is a first-class doubt". This differs from the frontend's current `LABEL_SEVERITY` (`unknown 1 < contested 2 < single-source 3`); the frontend constant is changed to this table in the same PR as the adapter (M6) and its test updated. Nothing else in the frontend depends on the order. `why` = the status rule's sentence + the claim's consequence in one sentence (template per claim id). Tests (`test_weakest_link.py`): established never chosen when any weaker exists; refuted > contested; contested > unknown; unknown > single-source; single-source > established; ties by count-against, then caveats, then causal order — each asserted with a two-claim fixture.

- **Contradictions and unknowns**: `[c for c in claims if c.status in ("contested","refuted")]`, `[c for c in claims if c.status == "unknown"]`.
- **Next question** (`pipeline/next_question.py`): the first claim in `["C_EXPOSURE", "C_ENGAGEMENT", "C_DOWNSTREAM", "C_CLINICAL"]` whose status is not `established`; one template per gate for `next_question`, `suggested_experiment_or_data`, `result_that_would_change_appraisal`; `why_this_question_matters` templated, optionally reworded at L10. If all four are `established`, `gate = "C_SAFETY"` with its template. One question, not a planner.
- **Recommendation stance** (`pipeline/appraisal.py`), before the LLM writes a word:

  | Condition (first match wins) | `stance` |
  |---|---|
  | fewer than two of the seven claims have any visible link | `insufficient_evidence` |
  | `C_CLINICAL` is `refuted` | `deprioritize` |
  | `C_EXPOSURE` or `C_ENGAGEMENT` is `unknown` and `C_CLINICAL` is not `established` | `no_clear_prioritization` |
  | every gate in `[C_EXPOSURE, C_ENGAGEMENT, C_DOWNSTREAM, C_CLINICAL]` is `established` or `single-source`, none `contested` | `pursue_conditionally` |
  | otherwise | `no_clear_prioritization` |

- **Validation** (`engine/validate.py`): structural (every claim has links or is `unknown`; every edge has a claim; every cited id exists; every Evidence has `publication_date`, `source_url`, `source_provider`, `transport`) plus the synthesis gate (§6). The appraisal is not returned until it passes.

## 6. Recommendation and evidence contract

1. `recommendation.opinion` is a short paragraph: *"Based on the evidence visible as of {as_of}, Elute would {stance phrase} … primarily because {reasons}"*; every reason is a claim id present in `rationale_claim_ids`.
2. Beside it, always: `supporting_claim_ids`, `opposing_claim_ids`, `key_unknowns`, `weakest_link` (by reference), `what_would_change_my_mind`.
3. Stance vocabulary is closed: `deprioritize · no_clear_prioritization · pursue_conditionally · insufficient_evidence`. The last two are first-class outputs; nothing is forced.
4. **No fabricated statistics.** No probabilities, model confidence, risk scores, effect sizes, p-values unless present verbatim in cited Evidence.
5. **Numeric validation** (`engine/validate.py::check_numbers`): extract numeric tokens from every generated sentence (regex over digits with optional decimal, thousands separators, `%`/`percent`/`per cent`, `n = 12`, `n=12`, ranges `0.23–1.5`); normalize each to `(value: Decimal, unit: "percent" | "count" | "ratio" | None)`; for the sentence's cited ids, extract the same tokens from `Evidence.statement`, every `Evidence.relevance[].statement` / `verbatim_sentence`, and `Evidence.pk_facts[].verbatim_sentence`; a generated number passes when a cited number has the same unit and `abs(a - b) <= 0.005 * max(|a|, |b|)` or identical after rounding to the cited precision (so `0.53%`, `0.53 %`, `0.530 percent` match). Any unmatched number → the sentence is rejected. Any token that reads as a probability or confidence (*"% chance"*, *"probability"*, *"confidence"*, *"likelihood"* adjacent to a number) is rejected regardless of match unless the cited Evidence contains it.
6. **The gate** rejects synthesis when: a sentence carries no resolving citation; a number fails §6.5; a claim with status `contested`/`refuted` has none of its against-links cited anywhere in the case against; the opinion's stance phrase disagrees with the deterministic `stance`; a reason names a claim id absent from the appraisal. One re-ask with the rejection reasons attached. Second failure → deterministic fallback: case for/against as bulleted claim statements grouped by status, `opinion` = the stance template sentence, `llm = "fallback"`. Never a silent downgrade.
7. The scientist's own call stays a separate, attributed frontend field (`localStorage`), never merged with Elute's opinion.

## 7. Phase 1 data models (`models.py`)

```
Evidence                                  one per source record: one publication, one trial record, one Open Targets row.
                                          A publication that bears on several claims is ONE Evidence with several relevance items;
                                          it is never split into one Evidence per claim.
  id                      "EV_" + sha256(f"{source_provider}|{source_record_id}|{evidence_kind}|{publication_date}")[:12]
  source_provider         open_targets | clinicaltrials_gov | pubmed | europe_pmc | fixture   — where the data originates; never "tooluniverse"
  source_record_id        NCT id · PMID (else PMCID, else DOI, else normalized_title+"|"+year) · Open Targets row key (chemblId|targetId|source for mechanisms; diseaseId|targetId|datasourceId|pmid for associations)
  evidence_kind           registration | results | publication | mechanism | association
  transport               tooluniverse | direct | fixture                                     — how Elute accessed it
  tool_name?              the exact ToolUniverse tool name when transport = tooluniverse; null otherwise
  supplements[]           recorded direct calls that dated or completed this record ("ctgov.study_design", "europepmc.dates"), each with transport = direct
  statement               a short SOURCE-LEVEL summary for display ("Open-label pilot of nilotinib in 12 PD patients, 2016").
                          Not the unit of scientific truth; claim status is never computed from it.
  source_name             "Reinwald 2014, BioMed Res Int" · "NCT03205488 registration (NILO-PD)"
  source_url
  publication_date        ISO date, the authoritative availability date (§9.2)
  date_confidence         exact | month | year | unknown
  study_type              rct | open-label | pk | commentary | observational | preclinical | protocol | label | meta-analysis | unknown
  controlled?, blinded?, placebo?, sample_size?, outcome?
  population              human | animal | cell-line | postmortem | na | unknown
  caveats[]               open-label · no-placebo · animal-model · cell-line · postmortem-tissue · exposure-not-measured ·
                          surrogate-biomarker · small-n · single-site · not-prespecified · retracted
  pk_facts[]              {value, unit, verbatim_sentence}
  relevance[]             the ATOMIC claim-level findings from this source — the only input to claim status:
                          {claim_id, direction: supports | contradicts | refutes | qualifies,
                           statement: normalized concise finding ("Nilotinib CSF concentration was a small fraction of plasma concentration."),
                           verbatim_sentence?: the source sentence where available}
  independence_group      normalized key (§10) or "unknown"
  authors[]               normalized "lastname-initial"; affiliation? (raw first affiliation)
  ledger_step             "L3"
  first_author, journal, year, group    — required by the frontend validator; group = independence_group or "unknown"

Claim
  id                      C_MECHANISM | C_DISEASE_RELEVANCE | C_EXPOSURE | C_ENGAGEMENT | C_DOWNSTREAM | C_CLINICAL | C_SAFETY   (fixed constants)
  statement               templated per id with the resolved drug/target/disease names
  node                    "c-Abl" · "brain exposure" · …
  evidence_ids[]          derived from Evidence.relevance
  status, status_why      derived from the visible relevance items that name this claim — never from Evidence.statement
  caveats[]               union over supporting evidence

MechanismEdge             source, relation, target, claim_id   — six fixed edges over the seven claims (C_SAFETY has no edge)

LedgerEntry               maps 1:1 to the frontend's LedgerRow L1–L10
  step, question, task?: biology | clinical_trials | literature
  transport               tooluniverse | direct | fixture | none
  tool_name?, query
  attempts[]              {n, transport, tool_name?, query, outcome: ok | error | empty | insufficient, reason?, records_returned, elapsed_ms}
  counts                  {results_retrieved, results_after_dedup, results_after_temporal_filter, records_withheld, results_selected_for_extraction}
                          (L2/L3/L4 record their own; L6 records the run totals; zeros elsewhere)
  status                  ok | retried | failed | skipped
  timestamp, elapsed_ms?, key_finding?, record_ids[]
  reasoning               AgentReasoning
  reasoning_source        template | openai

AgentReasoning            structured, user-facing; never hidden state
  question, reasoning, evidence_needed, selected_tool, tool_selection_reason,
  interpretation (cites ids), what_this_changes (only engine-derived statuses), next_action, next_action_reason

NextQuestion              next_question, why_this_question_matters, suggested_experiment_or_data, result_that_would_change_appraisal, gate
Recommendation            stance, opinion, rationale_claim_ids[], supporting_claim_ids[], opposing_claim_ids[], key_unknowns[], what_would_change_my_mind

CandidateAppraisal
  id                      "ap_" + uuid4().hex[:12]
  drug, disease, as_of, resolved: {drug_chembl_id?, disease_efo_id?, target_ensembl_id?, target_symbol?}
  data_mode               fixture | live | mixed
  llm                     openai | unavailable | fallback
  evidence[], claims[], mechanism_edges[]
  supporting_evidence_ids[], counter_evidence_ids[]
  strongest_case_for[], strongest_case_against[]        {text, cites[]}
  weakest_link            {claim_id, why, evidence_ids[]}
  next_question, recommendation
  ledger[]
```

**Fixture** (`fixtures/nilotinib_parkinsons.json`): the curated **evidence bundle** (every Evidence with its date, links and independence group, converted by hand from `src/fixtures/nilotinib.ts`), per-cutoff **curated synthesis** (`strongest_case_for/against`, `opinion`, `what_would_change_my_mind`, each item cited, validated by the same gate), and per-step curated `AgentReasoning`. Statuses, weakest link, next question and stance are **computed by the engine** from the bundle at the requested `as_of` — never stored — so fixture mode exercises the same code path as live and the backtest tests the engine.

## 8. Rendering through the existing seam (`api/adapt.py`)

The frontend is built against `CandidateDetail` / `QueryRecord` (`src/data/types.ts`) and `DataSource`. One adapter projects an appraisal into that contract; `validateCandidate` (frontend) must pass on it at every cutoff (`test_adapter_parity.py` runs the TS validator's rules ported, and M6 checks it in the browser console).

| Frontend field | From |
|---|---|
| `sources[]` | `evidence[]`; `ledger` = `ledger_step`; `design` = `study_type` (`unknown` → `observational` with caveat `design-unknown`) |
| `chain.claims[]` (six, in `CAUSAL_ORDER` without `C_SAFETY`) | `claims[]`; `evidence[]` = relevance links (`qualifies` → `supports`, caveat → `scope`) |
| `objections[]` | `strongest_case_against[]` items in order; `sources` = cites; `published` = latest cited date; `cites` = ledger steps of the cited evidence |
| `prerequisites[]` (exactly five, ids `exposure · engagement · blinding · biomarker · safety`) | `C_EXPOSURE`, `C_ENGAGEMENT`, `C_CLINICAL`, `C_DOWNSTREAM`, `C_SAFETY` statuses → `met` (established) · `conditional` (single-source, word *one study*) · `unmet` (contested / refuted / unknown, word = the status); Timeline `from` = the date the status last changed, computed by re-running the engine at each Evidence date |
| `best_evidence` | the visible `C_CLINICAL` Evidence with the highest (controlled, blinded, n) → `stage`, `outcome`; none → `{outcome: none, controlled: false, stage: preclinical}` |
| `weakest_link`, `cutoffs` | engine output; the three pinned cutoffs plus the requested `as_of` if different |
| `drivers` | categorical mapping from gate status: established 3 · single-source 2 · contested/unknown 1 · refuted 0 — a mapping, stated on Provenance, not a score |
| `recommendation`, `next_question`, `ledger[].reasoning` | new optional fields on `CandidateDetail` / `LedgerRow`; the frontend gains one Detail block and one disclosure per ledger row |
| `LedgerRow.execution` | `tool` = `tool_name or transport`, `query`, `run_at`, `retry` = the first non-ok attempt's `{reason, query}`, `verified.by = "automated"` |

## 9. Temporal visibility — the invariant

**Invariant.** *No OpenAI call, reasoning trace, synthesis step, claim attachment, or scientific interpretation may receive the content of a source whose authoritative availability date is after `as_of`.* The raw transport/cache layer may hold post-cutoff records for caching and debugging only. Nothing outside `connectors/` and `pipeline/temporal.py` may import or read the raw layer.

**Where the gate sits in the ten steps (one interpretation, used everywhere):**

- **L2 / L3 / L4 — retrieval + visibility gate (+ extraction at L4).** Each retrieval step dates its deduplicated metadata records and applies `visible(records, as_of)` **before** fetching any content and before any OpenAI call. L4 in full: search metadata → canonicalize → combine → deduplicate → assign authoritative dates → **pre-LLM temporal visibility gate** → rank → cap → fetch abstract text only for the selected visible records → OpenAI extraction on those abstracts. This is the only place post-cutoff records are excluded.
- **L5 — normalize to Evidence.** Converts the visible structured connector + extraction outputs into canonical `Evidence` objects with `relevance[]` findings and provenance. No raw source content flows further.
- **L6 — temporal audit.** Does **not** re-filter. Verifies that every `Evidence` satisfies `publication_date <= as_of`, writes the user-facing historical-visibility summary (`results_after_dedup`, `results_after_temporal_filter`, `records_withheld` per step and in total), and fails validation if any post-cutoff Evidence leaked through.

### 9.1 Order of operations, literature (L4)

The one authoritative literature order, used in §1, here, §11, §13 (L4) and M3:

```
retrieve metadata per facet         → PubMed_search_articles with include_abstract=false: pmid, title, authors, journal, pub_date, doi, pmcid
canonicalize metadata               → normalized ids, title, authors, affiliation, partial dates
combine facet results
deduplicate (§11.3)                 → one record per publication
assign authoritative date (§9.2)    → the batched Europe PMC date supplement runs here, on the deduplicated set
temporal filter                     → publication_date <= as_of
rank (§11.4)
cap (§11.4)                         → results_selected_for_extraction
fetch abstract text                 → ONLY for the selected, visible PMIDs: PubMed_get_article (direct fallback: NCBI efetch)
OpenAI extraction                   → sees visible abstracts only
```

**Reconciliation with the spike code:** `pipeline/tools.py` currently searches with `include_abstract: true` and `test_literature_records_carry_abstracts…` asserts abstracts on search records. M3 changes the search call to `include_abstract: false`, adds the `PubMed_get_article` fetch for selected visible ids, and rewrites that test to assert the opposite (search records carry no abstract; abstracts exist only on selected visible records). Enforced by type: the metadata model has no abstract field; the abstract model is constructed only by `fetch_abstracts(selected_visible_ids)`. The invariant: no post-cutoff source content may reach OpenAI, claims, reasoning, synthesis, the recommendation, or user-facing logs.

### 9.2 Authoritative dates (conservative: when uncertain, later)

| Provider / kind | `publication_date` | `date_confidence` | How obtained (spike, §20) |
|---|---|---|---|
| ClinicalTrials.gov **registration** | `studyFirstPostDate` | exact | the ToolUniverse trials tool does not return it: one direct ClinicalTrials.gov v2 call per NCT (`ctgov.study_design`), recorded on the trace as a `direct` supplement |
| ClinicalTrials.gov **results** (only when `hasResults`) | `resultsFirstPostDate` | exact | same supplement; creates the separate results record |
| PubMed publication | the **earliest day-level** date among PubMed `pub_date` (prose, parsed by `connectors/dates.py`) and Europe PMC `firstPublicationDate` (one batched direct lookup per step, `europepmc.dates`); a month- or year-only date resolves to the **last day** of its period | exact / month / year | verified: Pagan 2016 → 2016-07-01; Reinwald 2014 → 2014-06-15; the MAO-B commentary → 2017-01-01 (visible at the Nov 2017 cutoff); Simuni 2021 → 2021-03-01 (its 2020-12-14 online date is not exposed by either tool; later is the doubt direction) |
| Open Targets **mechanism** row | the label year in the FDA/DailyMed reference URL → `YYYY-12-31` (nilotinib: 2010-12-31) | year | rows reference the label, not a PMID |
| Open Targets **association** row | the date of the row's PMID via the literature date rule above | as above | ABL1 × Parkinson rows are all `europepmc` literature rows with one PMID each |
| Any row with no resolvable date | **never becomes Evidence** | — | stated in the trace as a count |
| Fixture | curated | exact | — |

A trial registration visible before `as_of` never exposes its results: registration and results are distinct Evidence with distinct ids, dates and statements; the registration statement never mentions the outcome.

### 9.3 The sentinel test (`test_temporal.py::test_future_sentinel_never_leaks`)

Inject into the cached transport layer a PubMed record dated `2021-01-15` whose title and abstract contain `FUTURE_RESULT_SENTINEL`, and a ClinicalTrials results record dated `2020-12-14` with the same phrase. Run the pipeline with `as_of = PRE_TRIAL_SNAPSHOT` against a recording `LLMClient` that captures every prompt. Assert the phrase appears in: no OpenAI input, no `AgentReasoning` field, no Claim, no Evidence in the appraisal, no synthesis item, no `LedgerEntry` field, and no log line at INFO or above. Assert the ledger's `results_after_temporal_filter` is smaller than `results_after_dedup` by exactly the injected count.

## 10. Independence groups (Phase 1 proxy)

`independence_group` is derived from publication metadata, conservatively, and is called a *proxy* on Provenance:

1. Prefer normalized **last author** + normalized **primary affiliation** → `"{last}|{affil}"`.
2. If no last author, **first author** + affiliation.
3. If no affiliation, the normalized author only → `"{author}|"`.
4. If neither author nor affiliation can be read confidently → `"unknown"`.
5. Two `"unknown"` groups never count as two groups.
6. Two records whose normalized author lists share the first author or the last author are the **same** group regardless of affiliation.

Normalization: lowercase, strip diacritics and punctuation, `lastname-firstinitial`; affiliation = first affiliation string, lowercase, first comma-separated segment, stripped of "department of" / "dept". Two PMIDs, two journals, or two years never imply independence. ClinicalTrials sponsors: `leadSponsor.name` normalized. Fixture records carry their curated group. OpenAlex improves this in Phase 2 (informational only, §17).

## 11. Retrieval: tool selection, bounded self-correction, dedup, caps

### 11.1 Tool selection is structural

| Task | Preferred (ToolUniverse, verified §20) | `source_provider` | Fallback (direct, same tool name, same payload shape — `connectors/direct.py`) |
|---|---|---|---|
| `resolve` (L1) | `OpenTargets_get_drug_chembId_by_generic_name` · `OpenTargets_get_disease_id_description_by_name` · `OpenTargets_get_target_id_description_by_name` | open_targets | Open Targets GraphQL search |
| `biology` (L2) | **`OpenTargets_get_drug_mechanisms_of_action_by_chemblId`** · `OpenTargets_get_evidence_by_datasource` | open_targets | Open Targets GraphQL `https://api.platform.opentargets.org/api/v4/graphql` |
| `clinical_trials` (L3) | **`ClinicalTrials_search_studies`** · `get_clinical_trial_status_and_dates` · `get_clinical_trial_conditions_and_interventions` · `extract_clinical_trial_outcomes`; plus the recorded direct supplement `ctgov.study_design` per NCT for masking, allocation, first-posted and results-posted dates | clinicaltrials_gov | ClinicalTrials.gov v2 `https://clinicaltrials.gov/api/v2/studies` |
| `literature` (L4) | **`PubMed_search_articles`** (metadata, `include_abstract=false`) · `PubMed_get_article` (abstracts for selected visible PMIDs); plus the recorded direct supplement `europepmc.dates` | pubmed (dates supplemented by europe_pmc) | NCBI E-utilities (esearch/efetch) answering the same tool names |

The three bold tools are the sponsor-compliance three. No LLM call chooses a tool. The agentic behaviour is query formulation, sufficiency judgement, refinement, follow-up, and when to fall back. ToolUniverse is a transport: `source_provider` names the dataset a tool wraps, never ToolUniverse. Supplements are ordinary direct calls recorded on the trace; they do not count toward the sponsor three.

### 11.2 The bounded loop (`pipeline/tools.py`), per task or facet

```
attempt 1: preferred tool, initial query (templated from resolved names/ids)
  evaluate (code): error | timeout → "error"; zero records → "empty";
                   records but none mention the resolved drug name/id AND disease name/id → "insufficient"; else "ok"
attempt 2 (if not ok): same transport, refined query
  refinement: biology/clinical_trials → deterministic synonym table (canonical name → EFO/MeSH label → ChEMBL preferred name)
              literature → OpenAI query refinement (§4) when configured, else the synonym table
attempt 3 (if not ok): direct fallback with attempt 2's query
stop. Max 3 attempts. Every attempt appended to LedgerEntry.attempts[].
```

Timeouts: 10 s per call; ToolUniverse and direct alike. ToolUniverse reports failures as `{"status": "error", "error", "error_details": {"type", "retriable"}}` rather than raising; `connectors/tooluniverse.py` converts them to `ToolError` so the loop records the attempt and proceeds (spike finding). The attempt whose records counted sets `transport` and `tool_name` on the entry and on every Evidence it produced. Query rules that the spike fixed: PubMed automatic term mapping needs the disease name **unquoted** in parentheses — `(Parkinson disease)` reaches the MeSH heading, `"Parkinson disease"` does not (`pipeline/tools.py::disease_expr`).

Dynamic focus at L4 (rules in code): if `C_CLINICAL` already has a controlled negative link after L3, facets run in the order exposure → engagement → alternative-explanation → criticism → biomarker → efficacy → mechanism → disease-hypothesis; otherwise the default order (§11.4). If after the first pass `C_EXPOSURE` has no link, one extra PK/CNS query is issued; if `C_ENGAGEMENT` has no link, one extra human-engagement query. Each extra query is one more bounded loop, capped at two extras per run.

### 11.3 Deduplication, before extraction and before counting

Key priority: PMID → PMCID → DOI (lowercased, `https://doi.org/` stripped) → `normalized_title + "|" + year` (lowercase, ASCII, punctuation stripped, whitespace collapsed). Applied to the combined, canonicalized facet results, before dating and the temporal filter (§9.1); the record keeps the union of facets that returned it (for ranking) and one set of metadata. `test_literature.py::test_dedup_across_facets`: the same PMID returned by three facets → one record after dedup, one extraction call, one Evidence, and `established` is not reached from that one record.

### 11.4 Caps and ranking

`MAX_RESULTS_PER_FACET = 5`, eight facets, so ≤ 40 retrieved; `MAX_UNIQUE_PAPERS_AFTER_DEDUP = 20` selected for extraction, so ≤ 20 extraction calls (+ ≤ 2 extras). Ranking for the cap, deterministic: primary = the best facet-priority the record was returned for, in this order — (1) controlled human clinical, (2) PK/exposure, (3) human target engagement, (4) criticism / commentary / alternative explanation, (5) downstream biomarker, (6) mechanistic human, (7) preclinical, (8) disease hypothesis; secondary = `citedByCount` desc; tertiary = PMID asc. The trace records `results_retrieved`, `results_after_dedup`, `results_after_temporal_filter`, `results_selected_for_extraction`.

## 12. Self-correction: tested, and demonstrated transparently

- **Path A — tested** (`test_self_correction.py`): the ToolUniverse literature call is made to fail (exception) and, in a second case, to time out. Assert: attempt 1 `outcome = error`, the reasoning records the failure and the decision, attempt 3 `transport = direct` invoked, the Evidence schema and ids identical to a ToolUniverse-delivered run on the same cached payloads, the appraisal succeeds.
- **Path B — natural**: when a live query genuinely returns `empty` or `insufficient`, the refinement runs and the trace shows it. Nothing is manufactured; no deliberately bad query is issued. Observed live in the spike: the *alternative explanation* facet is empty on the first query and found on the reformulated one (the MAO-B commentary is indexed under *Parkinsonian*) — a real, reproducible correction, replayed by `test_path_b_insufficient_records_trigger_a_reformulation`.
- **Live demo**: if no natural correction occurs, either show the tested trace, or set `ELUTE_DEMO_DISABLE_TOOL=literature`; the trace then reads *"This tool call was intentionally disabled to demonstrate recovery"* on attempt 1 and proceeds to the fallback. Fault injection is always labelled as such in the trace.

## 13. The ten steps

| Step | Question on the trace | Task / tool | OpenAI | Produces |
|---|---|---|---|---|
| L1 Resolve | *What exactly was asked?* | Open Targets search (disease → EFO id; drug → ChEMBL id via the drug search); ambiguity rule: if the top two hits' scores are within 10 %, take the one whose normalized name equals the query, else the top hit, and record both in the trace | no | `resolved`; templated reasoning |
| L2 Biology | *What is the target, and is it tied to the disease?* | task `biology`: drug → mechanism of action → target symbol/Ensembl id; target–disease association by datatype | no (templated interpretation from datatypes and scores as the source states them) | `C_MECHANISM`, `C_DISEASE_RELEVANCE` Evidence (kinds `mechanism`, `association`) |
| L3 Human trials | *Has this been tested in people?* | task `clinical_trials`: `ClinicalTrials_search_studies` (`query_cond`, `query_intr`) → per NCT the recorded direct supplement `ctgov.study_design` for masking, allocation, `studyFirstPostDate`, `hasResults`, `resultsFirstPostDate` | no | registration and results Evidence, separately dated; `C_CLINICAL` links (`supports` if positive, `refutes` if controlled+blinded+negative, `contradicts` if negative otherwise; a registration alone links nothing) |
| L4 Literature — retrieval + visibility gate + extraction | *What does the literature say?* | task `literature`, eight facets, in the §9.1 order: metadata (`PubMed_search_articles`, no abstracts) → canonicalize → combine → dedup → date (`europepmc.dates` supplement) → **pre-LLM temporal visibility gate** → rank → cap → fetch abstracts (`PubMed_get_article`, selected visible only) → extract; §11 loop per facet. L2 and L3 apply the same gate to their dated records before anything downstream. | extraction per selected visible abstract; refinement; interpretation | visible structured records for every gate; caveats; PK facts; the step's counts |
| L5 Normalize to Evidence | *Is every record a dated statement?* | `normalize.py`: visible structured connector + extraction outputs → canonical `Evidence` with `relevance[]` findings and provenance | no | `Evidence[]`; no raw source content flows further |
| L6 Temporal audit | *What was visible on {as_of}?* | `temporal.py::audit`: verifies every Evidence has `publication_date <= as_of` (no second filter); fails validation on any leak | no | the historical-visibility summary: per-step and total `results_after_dedup`, `results_after_temporal_filter`, `records_withheld`; templated reasoning with counts only, never withheld contents |
| L7 Claims | *What must be true for this to work?* | `claims.py`: seven fixed claims, six fixed edges; links from `relevance[]` | no | `Claim[]`, `MechanismEdge[]` |
| L8 Engine | *What holds, what is contested, what is unknown?* | `engine/` | no | statuses, weakest link, contradictions, unknowns, `stance`; templated reasoning naming each status change |
| L9 Elute synthesis | *What is the strongest case each way, and what does Elute think?* | synthesis + gate | yes | `strongest_case_for/against`, `recommendation` |
| L10 Next question + validate | *What should be answered next?* | `next_question.py`, `validate.py` | optional wording | `next_question`; the validated appraisal |

Fixture mode replays the same ten entries with curated `AgentReasoning`, `transport = fixture`, `reasoning_source = template`.

## 14. Failure and degradation

| Failure | Behaviour |
|---|---|
| ToolUniverse tool errors, times out, or returns nothing useful | §11.2 loop: refine, then direct fallback; each attempt in the trace; identical Evidence schema |
| A provider is down through both transports | after 3 attempts the step settles `failed` with the reason; dependent claims `unknown`; `data_mode = mixed`; the appraisal returns with `status = complete_with_gaps` |
| PubMed down through both transports | trials and biology remain; exposure / engagement / downstream become `unknown`; the case against uses what is visible |
| Europe PMC date supplement down | PubMed partial dates stand alone, resolved to the last day of their period (later = the doubt direction); the supplement's failure is on the trace |
| ClinicalTrials.gov v2 design supplement down | trial records keep the ToolUniverse fields; masking and posted dates are `unknown`; a registration with unknown `studyFirstPostDate` is dated by `start_date` if present, else hidden at historical cutoffs; no results record is created |
| OpenAI unavailable or no key | extraction: only connector-structured fields are used; abstracts become Evidence with `study_type = unknown`, no caveats, no relevance links (they count toward nothing); L4 refinement uses the synonym table; L4/L9/L10 reasoning templated; synthesis = deterministic fallback; `llm = unavailable` |
| Gate rejects synthesis twice | deterministic fallback; `llm = fallback` |
| Fixture mode | none of the above can occur; no network, no key; all three cutoffs work |

Never: a substituted record, a remembered fact, a number without a source, a hidden downgrade.

## 15. API (`/api`)

| Endpoint | Behaviour |
|---|---|
| `POST /appraisals` body `{"drug": "nilotinib", "disease": "Parkinson's disease", "as_of": "2017-11-20"}` (`as_of` optional; omitted → today) | `202` `{"id": "ap_…", "status": "running"}`. Fixture mode: `200` `{"id": "…", "status": "complete"}` — the appraisal is computed synchronously. Unresolvable drug or disease in live mode: `422` with the error shape. |
| `GET /appraisals/{id}` | `200` `{"id", "status": "running", "appraisal": null}` while running; `200` `{"id", "status": "complete", "appraisal": {...}}`; `200` `{"id", "status": "complete_with_gaps", "appraisal": {...}}` when any step settled `failed` or `llm != "openai"`; `200` `{"id", "status": "failed", "appraisal": null, "error": {...}}` only if the pipeline itself raised; `404` only when the id does not exist. |
| `GET /appraisals/{id}/events` (SSE) | one event per `LedgerEntry` start and settle, `data: {"entry": LedgerEntry, "done": bool}`; replays completed entries from the store on connect; closes after `done: true`. |
| `GET /appraisals/{id}/detail?as_of=` | `200` `{"candidate": CandidateDetail, "query": QueryRecord}` adapted (§8); same status rules as above (`404` unknown id; `409` `{"error": {"code": "running"}}` while running). |
| `GET /health` | `200` `{"mode", "llm_configured": bool, "connectors": {"biology": ..., "clinical_trials": ..., "literature": ...}}` each `{"preferred": "ok" \| "down" \| "unverified", "fallback": "ok" \| "down"}`; never the key or model. |

Error shape everywhere: `{"error": {"code": "<snake_case>", "message": "<human sentence>"}}`. Codes: `not_found`, `running`, `unresolvable_entity`, `invalid_as_of`, `pipeline_error`.

Frontend `ApiSource` (TS, ~60 lines): `query(slug)` → `POST /appraisals` for the pair; `run()` → `/events` mapped to `LedgerEvent`; `results()` / `candidate()` → `/detail`. A pair query is one appraisal, so the existing routes work unchanged. `VITE_ELUTE_API=http://localhost:8000/api`.

## 16. Module structure

Files marked ✓ exist from the spike and are kept (extended, not rewritten); everything else is built in the milestones.

```
backend/
  pyproject.toml ✓ (extend at M0A)   uv.lock (M0A provisional → M0B final)   .env.example ✓ (extend at M0A)   README.md (run + test commands)
  scripts/       spike_tooluniverse.py ✓   record_payloads.py ✓ (re-records cassettes)
  elute/
    main.py        settings.py      models.py        ids.py (evidence_id(), CLAIM_IDS, CAUSAL_ORDER)
    store.py ✓     PayloadCache today; M0A adds the SQLite run/event/appraisal tables beside it
    api/           appraisals.py  health.py  adapt.py
    connectors/    base.py ✓ (Task, RawRecord, Attempt, ToolError, CacheMiss)   tooluniverse.py ✓ (TOOL_NAMES: the eleven verified tools)
                   direct.py ✓ (DIRECT_NAMES: same tool names, same payload shape; ctgov.study_design; europepmc.dates)
                   records.py ✓ (one mapper per tool → RawRecord, parity-tested across transports)   dates.py ✓ (partial-date parsing, last-day rule)
                   enrich.py ✓ (literature_dates, trial_design supplements)
    pipeline/      tools.py ✓ (Task loop: DefaultSelector, sufficient(), run_task, ≤ 3 attempts)
                   orchestrator.py  canonicalize.py  dedup.py  temporal.py  normalize.py  claims.py  appraisal.py  next_question.py  reasoning.py (templates)
    engine/        labels.py  weakest_link.py  independence.py  validate.py
    llm/           client.py  openai_client.py  extraction.py  synthesis.py  prompts/*.md
    fixtures/      nilotinib_parkinsons.json
    parking/       genetics_validation.py  pathway_redundancy.py  literature_surveillance.py  real_world_evidence.py  patient_stratification.py
  tests/
    conftest.py ✓  test_tooluniverse_tools.py ✓  test_self_correction.py ✓
    test_fixture.py  test_ids.py  test_temporal.py  test_labels.py  test_independence.py  test_weakest_link.py  test_next_question.py
    test_stance.py  test_literature.py  test_connectors.py  test_recommendation_grounding.py  test_numbers.py  test_connector_failure.py
    test_adapter_parity.py  test_nilotinib_backtest.py  test_api.py
    fixtures/payloads/ ✓   the cassettes: tooluniverse/<tool_name>/<sha>.json and direct/<tool_name>/<sha>.json, keyed by tool + arguments,
                           replayed by PayloadCache; re-recorded only by scripts/record_payloads.py
docs/tooluniverse-spike.md   the spike's implementation contract (§20), written at M0B from the §20 findings
```

Boundaries: connectors never import the pipeline; `engine/` imports only `models` and `ids`; the LLM is behind `LLMClient`; only `connectors/` and `temporal.py` touch raw records; the retrieval steps (L2–L4) are the only code that sees pre-gate metadata, and they hand only `visible(...)` records onward; L6 audits, it never filters. Cache: `PayloadCache` keys by transport + tool name + arguments (`<transport>/<tool_name>/<sha>.json`); a cached payload is used whenever present, so rehearsed queries are deterministic and the test cassettes are the same files under `tests/fixtures/payloads/`.

## 17. Historical backtest — pinned

```python
EARLY_SNAPSHOT           = "2016-07-11"
PRE_TRIAL_SNAPSHOT       = "2017-11-20"
CURRENT_GOLDEN_SNAPSHOT  = "2026-09-20"
```

Runtime accepts `as_of` omitted (→ today's date) but every test expectation is pinned to the three constants. `test_nilotinib_backtest.py` runs on the fixture bundle and on the live cassettes:

| `as_of` | Must hold |
|---|---|
| `EARLY_SNAPSHOT` | Pagan 2016 visible; `C_CLINICAL = single-source`; `C_EXPOSURE = contested` (Reinwald 2014 contradicts, Pagan CSF detection supports); the MAO-B commentary absent; no record of either trial (Georgetown NCT02954978 first posted 2016-11-04; NILO-PD NCT03205488 first posted 2017-07-02); no Evidence with `publication_date > as_of`; `stance ∈ {no_clear_prioritization, insufficient_evidence}` |
| `PRE_TRIAL_SNAPSHOT` | the case against contains the three pre-trial concerns — open-label n = 12; low CSF exposure (0.53 % appears only if Reinwald is cited); the MAO-B withdrawal alternative — each cited. Two distinct trials, **registration-only** at this cutoff: the Georgetown phase 2 **NCT02954978** registration (first posted 2016-11-04, n = 75, quadruple-masked) may be visible, and the NILO-PD **NCT03205488** registration (Northwestern, first posted 2017-07-02, started 2017-10-16, n = 76, triple-masked) is visible; **no results from either**; registrations link nothing to `C_CLINICAL`. `C_CLINICAL` = whatever the deterministic rules derive from the visible links — under the curated link set (Pagan 2016 `supports`; the MAO-B commentary `contradicts` on `C_CLINICAL` and on `C_DOWNSTREAM`) that is `contested`; the test asserts the engine's output on the corrected bundle, and the expectation follows the engine, not the old fixture. `next_question.gate = C_EXPOSURE` and `weakest_link.claim_id = C_EXPOSURE` if still derived so under the corrected bundle (expected: yes — exposure is `contested` and first in the causal gate order). |
| `CURRENT_GOLDEN_SNAPSHOT` | **Both** controlled-trial result records are visible when retrieved, each its own Evidence with its own NCT id and results-posted date, neither substituting for the other: NILO-PD **NCT03205488** results (posted 2020-07-22; primary publication Simuni 2021, live date 2021-03-01 per §9.2, frontend fixture 2020-12-14 — both < the snapshot) and Georgetown **NCT02954978** results (posted 2026-06-12; primary publication Pagan 2020, *JAMA Neurol*). `C_CLINICAL` is derived from **all** visible clinical relevance links by the existing rules: both trials are randomised, blinded, placebo-controlled and negative on their primary clinical endpoints, so both primary publications carry `refutes` links (they pass the gate: `controlled=true, blinded=true, outcome=negative`) from two distinct independence groups (Northwestern; Georgetown) → `C_CLINICAL = refuted` with two refuting links; the registry results records carry `outcome` only from their matched primary publication (matched by NCT id or trial name in the abstract) and otherwise `na` with no link. If retrieval returns only one of the two, the status is still `refuted` from the one that is visible, and the test states which. `C_MECHANISM = established`; `C_DOWNSTREAM` established-with-caveat *animal-model* or contested (per the linked evidence); `C_EXPOSURE = contested`; `C_ENGAGEMENT = unknown`; `stance = deprioritize`; the opinion cites `C_EXPOSURE`, `C_ENGAGEMENT`, `C_CLINICAL`. The fixture bundle and the live cassettes carry the same two trials with the same ids and dates. |

Plus the frontend's fifteen-cell table (`src/lib/evidence.test.ts`) holds on the adapted record (`test_adapter_parity.py`). The sentinel test (§9.3) is part of this suite.

## 18. Phase 1 stop conditions

1. Fixture nilotinib + Parkinson's returns a valid `CandidateAppraisal` end to end.
2. The frontend renders the fixture result through `/detail` with no `not publishable` warning.
3. Live nilotinib + Parkinson's completes.
4. ClinicalTrials.gov evidence flows, registration and results dated separately.
5. PubMed literature flows across the eight facets in the §9.1 order, deduplicated, dated (with the Europe PMC supplement) and capped.
6. Open Targets evidence flows (mechanism, target, association).
7. The three pinned backtests pass on fixture and on cassettes.
8. The sentinel test passes: no post-cutoff content reaches the model, claims, reasoning, synthesis, or user-facing logs.
9. Every displayed claim resolves to Evidence or is `unknown`.
10. Weakest-link policy (§5) is encoded and its six tests pass.
11. The case against is citation-grounded; every contested/refuted claim's against-link is cited.
12. The recommendation is citation-grounded.
13. No generated number fails §6.5.
14. The recommendation exposes supporting and opposing claim ids.
15. The recommendation exposes `key_unknowns`.
16. `what_would_change_my_mind` is present and cites.
17. The next question is `C_EXPOSURE` at `PRE_TRIAL_SNAPSHOT` and reads as a scientist would ask it.
18. Any one provider can fail without killing the run.
19. Fixture mode works with no OpenAI key.
20. Live mode degrades honestly with no OpenAI key (`llm = unavailable`).
21. ToolUniverse is successfully installed and initialized (`tooluniverse==1.5.0`, M0B).
22. At least **three distinct real ToolUniverse tools** have successfully executed in the live appraisal.
23. Their exact names, call signatures, install method and example payloads are documented in `docs/tooluniverse-spike.md` and §20.
24. Each of the three contributes meaningfully to the Elute scientific workflow (Evidence in the hero appraisal or its supporting reasoning).
25. Direct API fallbacks and supplements do not count toward the three-tool requirement; if fewer than three tools executed, the gap is documented in §20/§21 and compliance is not claimed.
26. The reasoning trace shows the structural reason each tool was used and its query.
27. A tool result can influence a follow-up query or a later reasoning step (§11.2 dynamic focus, visible in the trace).
28. Self-correction path A passes; any live demonstration is natural or transparently labelled.
29. The direct fallback produces the same canonical normalized Evidence schema and ids.
30. Historical backtests pass regardless of ToolUniverse vs direct transport when both represent the same provider data.

Then **STOP** and show what works. Do not start Phase 2.

---

# PHASE 2 — ONLY AFTER PHASE 1 WORKS AND IS REVIEWED

## 19. OpenAlex — the Voloridge "Signal in the Noise" extension (informational only)

Enormous, noisy literature → citation structure → many apparent signals are correlated → identify the independent evidence roots → surface the actual signal. *Citation volume ≠ independent evidence.* One insight for both tracks: Voloridge (signal in the noise) and Regeneron (belief vs knowledge). Not a separate mode; OpenAlex enriches the same Evidence and Claims.

Per claim, from OpenAlex `referenced_works` over the claim's supporting Evidence (+ `authorships` when easy):

```
Claim.literature_structure                 (displayed beside the status; never changes it)
  apparent_supporting_paper_count          24
  approximate_independent_citation_roots   5
  largest_citation_lineage_fraction        0.54
  unique_author_groups?, unique_institutions?
  root_work_ids[]
```

Method, stated on Provenance: two-hop citation subgraph among the supporting works; roots = works with no in-subgraph ancestor; each work assigned to the root with the largest reachable path; the fraction is the largest root's share. Real counts on a real graph. **During the hackathon these metrics are informational only:** they are displayed separately from `status`, never converted into a reliability score, confidence, or truth probability, and never change `established`, `contested` or `refuted`. Whether they should replace the §10 proxy is future validation work.

Connector `connectors/openalex.py` (polite pool, mailto); an enrichment inside L4 or a step after L8; tests on a synthetic graph with known roots and on the nilotinib preclinical claim's lineage.

Optional order after OpenAlex: safety gate (openFDA, Open Targets liabilities); structured PK extraction; human target-engagement extraction; downstream biomarker extraction; Reactome enrichment; simple alternate-path / redundancy; same-target and same-pathway trial history; additional candidates; drug-first queries.

# FUTURE — VISIBLE PARKING SPOTS

## 20. Implementation-time discoveries and the ToolUniverse spike

| Discovery | Goal | Time box | Success criterion | Fallback | Recorded in | Status |
|---|---|---|---|---|---|---|
| **ToolUniverse spike** | install and initialize ToolUniverse; list available tools; verify **three distinct** real tools against nilotinib/Parkinson's — preferred: biology/target, clinical trials, literature | 90 min, day one | three distinct tools execute and return records that contribute to the hero appraisal (verified again in the live API run of Sept 20 evening: L2/L3/L4 all `transport = tooluniverse`) | (1) a preferred category has no usable tool → search ToolUniverse for another scientifically relevant distinct tool (biomarker, target, genetics, molecular interaction, safety, literature, trial evidence — only if a real verified tool exists); the replaced category runs on its direct API. (2) fewer than three work after the full box → document how many and which failed, keep direct APIs for product function, mark the gap in §21, do not claim compliance. Never invent a tool. | `docs/tooluniverse-spike.md`; the table below; `backend/tests/fixtures/payloads/tooluniverse/` | **Done 2026-09-20** — all three preferred categories verified; no substitute needed |
| **Europe PMC affiliation availability** | confirm which of `authorAffiliationDetailsList` / `affiliation` the core result exposes for the hero papers (PubMed `authors[]` from the spike may or may not carry affiliations) | 20 min, inside M3 | independence groups resolve for ≥ 80 % of the hero papers | rule 3/4 of §10 (author-only / unknown) | `engine/independence.py` docstring | open |
| **`OPENAI_MODEL`** | the operator sets a model that supports structured outputs via the Responses API | — | the M0A probe succeeds | `llm_configured = false`; live mode degrades per §14 | `.env` (operator) | open |

**Spike deliverable — `docs/tooluniverse-spike.md`** (written at M0B from the findings below; the implementation contract). For the install: package/repo, exact version, install method, exact initialization code, settings/environment requirements (mirrored in `settings.py` and `.env.example`). For **each verified tool**: task/category · exact tool name · ToolUniverse description · exact Python initialization · exact call syntax · required arguments · optional arguments · result shape · example nilotinib/Parkinson's query · a representative successful response (the cassette path) · timeout/error behaviour · the provider the data represents (`source_provider`) · the Elute normalizer (`connectors/records.py` mapper). No placeholder may remain in it or in the table below before full implementation begins.

**Verified ToolUniverse tools.** Names read from `src/tooluniverse/data/*.json` on `mims-harvard/ToolUniverse` `main`, then each run live for nilotinib `CHEMBL255863` / Parkinson disease `MONDO_0005180` on 2026-09-20; payloads recorded under `backend/tests/fixtures/payloads/` and replayed by `backend/tests/test_tooluniverse_tools.py`. `backend/elute/connectors/tooluniverse.py` (`TOOL_NAMES`) loads exactly these fourteen and nothing else. Install: `tooluniverse==1.5.0` (PyPI 2026-09-16), Python ≥ 3.10, no key required (`NCBI_API_KEY` optional).

| # | Category | Exact tool name (bold = the sponsor-compliance three) | `source_provider` | Call signature | Cassette | Verified |
|---|---|---|---|---|---|---|
| — | L1 resolve | `OpenTargets_get_drug_chembId_by_generic_name` · `OpenTargets_get_disease_id_description_by_name` · `OpenTargets_get_target_id_description_by_name` | open_targets | `{drugName}` / `{diseaseName}` / `{targetName}` → `data.search.hits[]{id, name, description}` | `payloads/tooluniverse/<tool>/` | 2026-09-20 |
| 1 | biology / target | **`OpenTargets_get_drug_mechanisms_of_action_by_chemblId`** · `OpenTargets_get_evidence_by_datasource` | open_targets | `{chemblId}` → `data.drug.mechanismsOfAction.rows[]{mechanismOfAction, actionType, targetName, targets[]{id, approvedSymbol}, references[]{source, urls[]}}` · `{efoId, ensemblId, datasourceIds?, size}` → `data.disease.evidences{count, rows[]{datasourceId, datatypeId, score, resourceScore, literature[] (PMIDs), target, disease, urls[]}}` | `payloads/tooluniverse/OpenTargets_get_drug_mechanisms_of_action_by_chemblId/`, `…/OpenTargets_get_evidence_by_datasource/` | 2026-09-20 |
| 2 | clinical trials | **`ClinicalTrials_search_studies`** · `get_clinical_trial_status_and_dates` · `get_clinical_trial_conditions_and_interventions` · `extract_clinical_trial_outcomes` | clinicaltrials_gov | `{query_cond, query_intr, query_term?, filter_status?, filter_phase?, page_size ≤ 1000}` (multi-word terms in parentheses sent verbatim) → `data.studies[]{nct_id, brief_title, status, study_type, phases[], enrollment, conditions[], interventions[], sponsor, start_date, completion_date}` · `{nct_ids[]}` → per-NCT `overall_status, start_date, primary_completion_date, completion_date` / `arm_groups[]{label, type}` / `outcomes[]` | `payloads/tooluniverse/ClinicalTrials_search_studies/` | 2026-09-20 |
| 3 | literature | **`PubMed_search_articles`** · `PubMed_get_article` | pubmed | `{query, limit ≤ 200, include_abstract}` → `data[]{pmid, title, abstract?, authors[], journal, pub_date (prose: "2016 Jul 11" / "2014"), pub_year, doi, pmcid, url}` · `{pmid: "a,b,c"}` → the same plus `mesh_terms[]`, `publication_types[]` | `payloads/tooluniverse/PubMed_search_articles/` | 2026-09-20 |
| 4 | safety (label) | **`FDA_get_boxed_warning_info_by_drug_name`** · `OpenTargets_get_drug_warnings_by_chemblId` · `OpenTargets_get_drug_adverse_events_by_chemblId` | openfda · open_targets | `{drug_name, limit}` → `results[]{openfda.brand_name[], openfda.generic_name[], boxed_warning[] (+ warnings_and_cautions[] / warnings[] when there is no box)}` (no dates: the `openfda.label` supplement adds `set_id`, `version`, `effective_time`, `application_number` and the sections) · `{chemblId}` → `data.drug.drugWarnings[]{warningType, toxicityClass, country, year, references[]}` · `{chemblId, page}` → `data.drug.adverseEvents{count, rows[]{name, count, logLR}}` | `payloads/tooluniverse/FDA_get_boxed_warning_info_by_drug_name/`, `…/OpenTargets_get_drug_warnings_by_chemblId/`, `…/OpenTargets_get_drug_adverse_events_by_chemblId/` | 2026-09-20 |

Recorded direct supplements (transport `direct`, not ToolUniverse, never counted toward the three): `openfda.label` (every product label for the name, trimmed: set id, version, `effective_time`, application number, boxed warning, warnings and precautions, contraindications, indications; the originator's label — the oldest NDA/BLA — is the one Evidence), `ctgov.study_design` (ClinicalTrials.gov v2 per NCT: masking, allocation, `studyFirstPostDate`, `hasResults`, `resultsFirstPostDate`) and `europepmc.dates` (batched `firstPublicationDate` by PMID). Cassettes under `payloads/direct/`.

Facts the spike established, now encoded in `backend/elute/connectors/`:

- **No ToolUniverse trials tool returns masking, allocation, `studyFirstPostDate` or `resultsFirstPostDate`** (`ClinicalTrials_get_study` returns only `nct_id, brief_title, official_title, status, study_type, phases, enrollment, brief_summary, conditions, interventions, primary_outcomes, eligibility_criteria, sponsor, locations, references`). One direct ClinicalTrials.gov v2 call per NCT (`ctgov.study_design`) is a *recorded supplement* on the trace (`transport = direct`); it dates the registration record and creates the separate results record.
- **`EuropePMC_search_articles` returns only `year`;** `PubMed_search_articles` returns `pub_date` as prose, day-level for most records but year-only for two the backtest needs (Reinwald 2014 → `"2014"`, the MAO-B commentary → `"2017"`). The literature date is therefore the earliest day-level date among PubMed `pub_date` and Europe PMC `firstPublicationDate` (one batched direct lookup per step, `europepmc.dates`); a month- or year-only date resolves to the last day of its period (`connectors/dates.py`). Verified: Pagan 2016 → 2016-07-01 (Europe PMC; PubMed says Jul 11); Reinwald 2014 → 2014-06-15; the MAO-B commentary → 2017-01-01, visible at the Nov 2017 cutoff; Simuni 2021 → 2021-03-01 (its online date, 2020-12-14, is only in NCBI's history field, which neither tool exposes; later is the doubt direction).
- The nilotinib mechanism rows reference the FDA label and DailyMed, not a PMID; a row is dated by the label year in the FDA URL (2010 → 2010-12-31). The ABL1 × Parkinson disease association rows are all `europepmc` literature rows with one PMID each; a row without a PMID stays undated and never becomes Evidence.
- ToolUniverse reports failures as `{"status": "error", "error", "error_details": {"type", "retriable"}}`, not exceptions; the connector converts them to `ToolError` so the loop records the attempt and falls back (path A). The direct connector answers the same tool name and arguments with the same payload shape, so one mapper per tool serves both transports (`connectors/records.py`, parity-tested).
- PubMed automatic term mapping needs the disease name **unquoted** (`(Parkinson disease)` reaches the MeSH heading; `"Parkinson disease"` does not). Live, the *alternative explanation* facet is empty on the first query and found on the reformulated one (the commentary is indexed under *Parkinsonian*): a real, reproducible path-B correction.
- No key is needed for any tool above. `OPENALEX_API_KEY` is required for Phase 2's OpenAlex tools (anonymous requests return 503 since 2026-02-13).
- **Registry finding to carry into the fixture:** NCT02954978 is the Georgetown phase 2 (n = 75, quadruple-masked, first posted 2016-11-04, results posted 2026-06-12); **NILO-PD is NCT03205488** (Northwestern, n = 76, triple-masked, first posted 2017-07-02, started 2017-10-16, results posted 2020-07-22). The curated frontend fixture's `nct02954978` source carries NILO-PD's n and blinding under the Georgetown id and date. The backtest expectations hold either way (both registrations visible at Nov 2017, no results), but the id in `src/fixtures/nilotinib.ts` should be corrected.

## 21. Regeneron *Agentic Clinical AI Orchestrator* compliance

| Starter-kit requirement | Elute's implementation |
|---|---|
| **High-level task** | *"Appraise nilotinib for Parkinson's disease."* (`POST /appraisals`) |
| **Sequential execution** | the ten-step Elute pipeline (§13), each step a recorded `LedgerEntry` |
| **ToolUniverse** | **three distinct verified real ToolUniverse tools**, each executed successfully and contributing to the hero appraisal: #1 `OpenTargets_get_drug_mechanisms_of_action_by_chemblId` (biology/target), #2 `ClinicalTrials_search_studies` (clinical trials), #3 `PubMed_search_articles` (literature) — with eight sibling ToolUniverse calls in the same steps (§20). Direct API fallbacks and supplements improve reliability but **do not count** toward this requirement. Compliance is claimed only once stop conditions 21–25 hold on the live run. |
| **Agentic reasoning** | visible `AgentReasoning` per step: question · reasoning · evidence needed · tool used · why · result · interpretation · what changed · next action · why |
| **Self-correction** | bounded failure/insufficiency handling (§11.2) + direct fallback; tested (§12, path A: error and timeout); natural live correction (path B, observed); optional transparent fault injection labelled *"This tool call was intentionally disabled to demonstrate recovery."* |
| **Visible tool invocation** | per attempt: `transport`, exact `tool_name`, query, result count, outcome, follow-up — in the same trace |

## 22. Milestones — build in order, tests green after each

| Milestone | Build | Pass when |
|---|---|---|
| **ToolUniverse spike** | §20 — **done**; findings recorded in §20, cassettes committed, `connectors/` and `pipeline/tools.py` exist | three tools verified ✓ |
| **M0A Bootstrap** (known dependencies) | extend the existing `pyproject.toml` to the full §3 table, provisional `uv.lock`, `settings.py`, `main.py`, `/health`, extend `.env.example`, SQLite schema in `store.py` | `uv run uvicorn elute.main:app` boots; `GET /api/health` returns the §15 shape with `llm_configured` correct; `uv run pytest` runs the existing spike tests green. The lock is **not** final. |
| **M0B Dependency freeze** | confirm `tooluniverse==1.5.0` and any spike settings in `pyproject.toml` / `settings.py`; `uv lock && uv sync --extra dev`; rerun bootstrap and spike tests; write `docs/tooluniverse-spike.md` from §20 | boots and all tests pass with ToolUniverse imported; **final `uv.lock` committed**; the spike doc has no placeholders |
| **M1 Data contract + fixture** | `models.py`, `ids.py`, `fixtures/nilotinib_parkinsons.json` — with the registry correction from the spike: NILO-PD is **NCT03205488** (Northwestern, n = 76, triple-masked, first posted 2017-07-02, results posted 2020-07-22) and NCT02954978 is the Georgetown phase 2 (n = 75, first posted 2016-11-04, results posted 2026-06-12); the frontend fixture `src/fixtures/nilotinib.ts` gets the same correction in M6 | `test_fixture.py`: the bundle validates; `test_ids.py`: ids are stable across shuffled input |
| **M2 Deterministic engine** | `temporal.py` (`visible()` gate and `audit()`), `labels.py`, `independence.py`, `weakest_link.py`, `next_question.py`, stance in `appraisal.py`, `validate.py` (structural), `reasoning.py` templates | `test_temporal`, `test_labels`, `test_independence`, `test_weakest_link` (six cases), `test_next_question`, `test_stance`; `test_nilotinib_backtest` on the fixture at the three pinned dates |
| **M3 Connectors** | on top of the spike code: `canonicalize.py`, `dedup.py`, dating, `normalize.py` in the §9.1 order; literature search switched to `include_abstract=false` + `PubMed_get_article` for selected visible ids (and the spike test rewritten accordingly); `source_provider` / `transport` / `tool_name` / `supplements` on every record; the `visible()` gate wired inside L2/L3/L4 before any content fetch; caps and the five counts; cassettes re-recorded where calls changed | `test_connectors` (cassettes), `test_tooluniverse_tools` (each of the three executes), `test_literature` (order, dedup, caps, counts, no abstract before the gate and cap), `test_connector_failure`; fallback yields identical normalized schema and ids |
| **M4 OpenAI** | `openai_client.py`, `extraction.py`, `synthesis.py`, prompts, `check_numbers`, the gate, OpenAI reasoning for L4/L9/L10 | `test_recommendation_grounding`, `test_numbers`, `test_temporal::test_future_sentinel_never_leaks` with the recording client |
| **M5 Orchestration** | `orchestrator.py`, `tools.py` (bounded loop, dynamic focus, `ELUTE_DEMO_DISABLE_TOOL`), full live pipeline | end-to-end live nilotinib appraisal on cassettes and on the network; `test_self_correction` (path A, error and timeout) |
| **M6 API + adapter** | `appraisals.py`, `/events`, `adapt.py`, `/detail`; frontend: `ApiSource`, two optional fields, the Detail block, the ledger reasoning disclosure, `LABEL_SEVERITY` updated to §5 | `test_api`, `test_adapter_parity`; the frontend on `VITE_ELUTE_API` renders fixture and live with no `not publishable` warning |
| **M7 Golden demo** | — | the three pinned dates pass on fixture and live cassettes with every presence and absence assertion in §17; all 30 stop conditions checked off; **STOP** |

## 23. Future parking spots (interfaces only; `parking/`)

| Module | Purpose | Needs |
|---|---|---|
| `genetics_validation` | causal human genetics for the target (Mendelian, coding, fine-mapped, MR); any Open Targets datatype shown in Phase 1 is labelled *proxy* | MR pipelines; proprietary genetics in deployment |
| `pathway_redundancy` | alternate routes around the target, branch points, other intervention points over Reactome | Reactome graph; graph tooling |
| `literature_surveillance` | new paper → affected claim → re-appraise → status change → alert | scheduler; saved appraisal to diff |
| `real_world_evidence` | off-label / routine-care signal; never promotion | governed data; causal inference |
| `patient_stratification` | whether the candidate only makes sense in a subgroup | subgroup trial data; genetics |

Each has a typed interface, a docstring with purpose and data needs, and can write a `skipped` entry to the trace so the gap is visible.

## 24. Explicitly deferred (unless already trivial and working)

PrimeKG · STRING visualisations · complex Reactome UI · PowerPoint backend export (the deck is a frontend concern) · full genetic analysis · Mendelian randomisation · real-world patient data · a surveillance worker · arbitrary paper upload (paste-a-paper stays fixture-only) · the ALS second query · broad drug-first search · dozens of candidates · automatic diagram generation · any trained ML model · any composite score · multiple LLM providers · massive knowledge-graph downloads · patient-facing recommendations · ChEMBL, Reactome, STRING and OpenAlex as Phase 1 dependencies (openFDA joined Phase 1 on Sept 20 as the label behind the safety read) · `PathwayDrawing` / `Delivery` (optional fields already in `types.ts`; the adapter leaves them unset; the curated frontend fixture carries them; nothing in Phase 1 depends on them) · `/manifest`, `/tools`.

## 25. Henry / Regeneron alignment

| Henry's insight | Phase 1 | Phase 2 / future |
|---|---|---|
| **Explain the rationale** | seven fixed claims, six edges; every claim resolves to Evidence or `unknown`; the reasoning trace per step | Reactome enrichment; the pathway drawing (frontend) |
| **Belief vs knowledge** | per-claim supporting / contradicting / qualifying links with design, n, caveats; `single-source` as a status; conservative independence proxy | OpenAlex: are 20 papers 20 pieces of evidence? (informational) |
| **Assume you've done this wrong** | `strongest_case_against`, drafted only from visible evidence, cited, gated | critic-persona dev-time eval |
| **Failed trials matter** | ClinicalTrials.gov in Phase 1; registration and results dated separately | same-target / same-pathway trial history |
| **Exposure** | `C_EXPOSURE`; the next question defaults here | structured PK; route |
| **Target engagement** | `C_ENGAGEMENT`, separate; `unknown` shown as such | human engagement extraction |
| **Downstream biology / biomarker** | `C_DOWNSTREAM`; the MAO-B alternative is a contradicting link on it | biomarker extraction |
| **Safety** | the FDA label as dated evidence on `C_SAFETY` (boxed warning, warnings by body system, contraindications), Open Targets black-box classes and FAERS signals; the Safety block and the fifth prerequisite derived from it | target liabilities + expression breadth; historical label versions |
| **Pathway redundancy** | parking spot on the trace | `pathway_redundancy` |
| **Genetic validation** | Open Targets datatype as a labelled *proxy*, or omitted | `genetics_validation` |
| **Know the next question** | one `next_question` with why, experiment/data, and the result that would change the appraisal | a ranked research agenda |
| **Research agenda** | the next question is item one | ranked unresolved gates |
| **Literature surveillance** | parking spot | `literature_surveillance` |
| **Real-world evidence** | parking spot; never promotion | `real_world_evidence` |
| **Scientist UX** | structured objects rendered by the existing frontend | the v2.2 surfaces |
| **Provenance for IT** | `source_provider`, `transport`, `tool_name`, query, timestamp, counts, every attempt | `/manifest`, `/tools` |
| **Show the agent's chain of thought** | `AgentReasoning` per step, generated for the scientist, stored with the run | — |
| **Recommendation transparency** | an opinion only downstream of visible evidence, with supporting and opposing ids, unknowns, and what would change it; may decline | ranking across candidates with the same contract |

## 26. Voloridge alignment

The literature is enormous and noisy; papers cite papers; twenty supporting abstracts may descend from one 2013 mouse study. Counting them as twenty signals is the noise. OpenAlex's citation graph finds the independent roots and reports *apparent support: 24 · independent roots: 5 · largest lineage: 54 %* — real counts on a real graph, never a truth score, displayed beside the claim status without changing it during the hackathon. It plugs into the same Evidence and Claim objects and the same trace.

---

## Summary

**What changed in v4.4.** Final consistency: the temporal visibility gate is defined once as living inside the retrieval steps (L2/L3/L4) before any content fetch or model call, L5 normalizes, and L6 is a *temporal audit* that verifies and summarises but never filters; the two nilotinib trials are distinguished everywhere (Georgetown phase 2 NCT02954978 vs NILO-PD NCT03205488) and the pre-trial and current golden expectations are stated against the corrected evidence set with `C_CLINICAL` derived from all visible links; the summary now describes the backend code that exists from the spike. No architectural change.

**What changed in v4.3.** Consistency only, plus absorbing the completed spike: the product name is Elute everywhere (the old working name survives only in the superseded `PRD.md`); ToolUniverse is split into a runtime requirement (direct fallbacks keep Elute working) and a sponsor-compliance requirement (three distinct real tools executed and contributing; fallbacks and supplements never count; a shortfall would be documented, not papered over) — and the three are now named; one literature order — metadata → canonicalize → combine → dedup → date → temporal filter → rank → cap → fetch abstracts → extract — stated in §1, §9.1, §11, §13 and M3, with the one spike-code change it requires (`include_abstract=false` + `PubMed_get_article`); `Evidence` is publication-level with `Evidence.relevance[]` as the atomic claim-level findings (`statement` + `verbatim_sentence?`) and `Evidence.statement` demoted to a display summary; `source_provider` gains `pubmed` and Evidence gains `supplements[]`; dates follow the spike's verified rule (earliest day-level of PubMed/Europe PMC; partial → last day; CT.gov dates via the recorded direct supplement); M0 split into M0A (known dependencies, provisional lock) → M0B (final lock + `docs/tooluniverse-spike.md`); the module structure marks what already exists; stop conditions 21–30 and §21 rewritten; the NILO-PD registry correction is scheduled into M1/M6.

**What changed in v4.2.** Specification only: the weakest-link policy is an explicit `WEAKNESS` table with `max()` and three tie-breaks (and the frontend's `LABEL_SEVERITY` is scheduled to match); the temporal invariant is stated and enforced by fetching abstracts only for visible records, by type, and by a sentinel test; Evidence ids are content-derived hashes and claim ids are seven constants; `Evidence` is publication-level with `relevance[]` links (direction per claim) so one paper is one source; independence groups have a conservative operational definition; literature is deduplicated (PMID → PMCID → DOI → title+year) and capped (5 per facet, 20 after dedup) with a ranking rule and four audited counts; OpenAI is used only at L4 (extraction, refinement, interpretation), L9 and optional L10, everything else templated; tool selection is structural per task; self-correction is tested (path A), natural (path B), or transparently injected (`ELUTE_DEMO_DISABLE_TOOL`); provenance separates `source_provider`, `transport`, `tool_name`; `main.py`, `settings.py`, `pyproject.toml`, the `uv` workflow and a pinned dependency table are specified; API statuses are `running · complete · complete_with_gaps · failed` with `404` only for unknown ids and one error shape; golden dates are pinned constants; OpenAlex is informational only; numeric validation normalizes formatting; milestones M0–M7 with pass criteria; implementation-time discoveries are time-boxed with fallbacks.

**What changed from v3.** One case instead of a discovery pipeline; three scientific tasks through ToolUniverse with three direct fallbacks instead of nine connectors; a small `CandidateAppraisal` instead of `CandidateDetail` plus twenty optional additions; OpenAI instead of Anthropic; an explicit, gated opinion instead of "never recommends"; seven fixed claims instead of an LLM-assembled chain; a deterministic `stance` and a synthesis gate; the reasoning trace kept as a primary feature; Phase 1 / Phase 2 / Future; ChEMBL, openFDA, Reactome, STRING, OpenAlex out of Phase 1; ToolUniverse in Phase 1.

**What was deferred.** §19 (OpenAlex, first after approval), §23, §24.

**Existing backend code — extend, do not rewrite.** The backend foundation from the ToolUniverse spike already exists (the ✓ files in §16): base connector/task types (`connectors/base.py`), the ToolUniverse connector (`connectors/tooluniverse.py`), the direct API connector (`connectors/direct.py`), shared record mappers (`connectors/records.py`), date parsing (`connectors/dates.py`), enrichment/supplement calls (`connectors/enrich.py`), the payload cache (`store.py`), the bounded retry/self-correction loop (`pipeline/tools.py`), ToolUniverse and direct test cassettes (`tests/fixtures/payloads/`), and the spike tests (`tests/test_tooluniverse_tools.py`, `tests/test_self_correction.py`). Still to be implemented: the appraisal models, the deterministic scientific engine, the OpenAI layer, the API endpoints, the orchestration layer, the frontend adapter, and the golden-demo integration.

**Existing code reused unchanged.** From the frontend: the six ordered status rules (`src/lib/evidence.ts`, ported); `validateCandidate` as the integration gate; the `DataSource` seam and `ApiSource` slot; the `CandidateDetail` / `LedgerRow` contract; the curated nilotinib record (`src/fixtures/nilotinib.ts`) as the source of the backend fixture bundle; the ten ledger step names; the fifteen-cell backtest table.

**What must be refactored.** Frontend, in M6: `types.ts` gains optional `recommendation`, `next_question`, `LedgerRow.reasoning`; `LABEL_SEVERITY` changes to the §5 table with its test; Detail gains one block; the ledger row gains a reasoning disclosure; `ApiSource` is written. Docs: PRD v2.2 §6/§7 and `CLAUDE.md` principle 5 amended for the grounded-opinion contract.

**Phase 1 estimated complexity.** ~32–38 person-hours remaining across M0A–M7 (the spike and the connector loop are done); two people, ~16–18 hours wall clock with M3 (connectors + spike) in parallel with M1–M2.

**The critical path.** spike ✓ → M0A → M0B → M1 → M2 → M3 → M4 → M5 → M6 → M7 → STOP → OpenAlex only after approval.

**The first thing to implement after approval.** M0A: extend the existing `backend/pyproject.toml` to the §3 table, provisional `uv.lock`, `settings.py`, `main.py`, `/health`, extend `.env.example`, the SQLite schema in `store.py`; then M0B freezes the lock and writes `docs/tooluniverse-spike.md` from §20. M1 follows.
