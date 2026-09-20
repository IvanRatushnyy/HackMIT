# Elute backend

Phase 1 of `docs/BACKEND_PLAN.md` v4.4 FINAL: one drug–disease appraisal (nilotinib for Parkinson's disease), three scientific tasks through three verified ToolUniverse tools with direct API fallbacks, a deterministic evidence engine, OpenAI at bounded, cited steps, and a historical backtest at three pinned dates.

## Run

```sh
cd backend
uv sync --extra dev                                   # Python 3.12; installs tooluniverse==1.5.0 and everything else from uv.lock
cp .env.example .env                                  # then set OPENAI_API_KEY and OPENAI_MODEL (optional; fixture mode needs neither)
uv run uvicorn elute.main:app --reload --port 8000    # ELUTE_MODE=fixture by default; ELUTE_MODE=live for the real pipeline
uv run pytest                                         # 90+ tests, all offline on recorded cassettes
```

Frontend against the backend: `VITE_ELUTE_API=http://localhost:8000/api npm run dev` from the repo root.

## Endpoints (`/api`)

| | |
|---|---|
| `POST /appraisals {drug, disease, as_of?}` | fixture: `200 {id, status: complete}` (synchronous); live: `202 {id, status: running}` |
| `GET /appraisals/{id}` | `{id, status: running \| complete \| complete_with_gaps \| failed, appraisal}`; `404` only for an unknown id |
| `GET /appraisals/{id}/events` | SSE, one event per ledger step start and settle, replayed from the store |
| `GET /appraisals/{id}/detail?as_of=` | the frontend's `CandidateDetail` + `QueryRecord` |
| `GET /health` | `{mode, llm_configured, connectors}` — never the key |

## What is where

`elute/models.py` the contract · `elute/ids.py` stable ids and the seven claim constants · `elute/engine/` status rules, independence proxy, weakest link, validation and the synthesis gate · `elute/pipeline/` the ten steps (temporal gate + audit, literature order, claims, next question, stance, orchestrators) · `elute/connectors/` ToolUniverse and direct transports, mappers, dates, supplements · `elute/llm/` OpenAI client, schemas, prompts, extraction, synthesis · `elute/api/` routers and the frontend adapter · `elute/fixtures/` the curated nilotinib bundle · `elute/parking/` visible parking spots · `tests/fixtures/payloads/` connector cassettes · `docs/tooluniverse-spike.md` the ToolUniverse contract.

## Honesty notes

- Without `OPENAI_API_KEY`, live runs still complete: abstracts are read but no claim-level findings are extracted, so literature-dependent claims stay `unknown` and the appraisal reports `llm: unavailable`. Nothing is substituted.
- Cassettes are recorded in a fixed order: `scripts/record_payloads.py` (the resolve/biology/trials/search payloads) → `scripts/record_literature.py` (the Europe PMC dates and `PubMed_get_article` for the batches the real `LiveRun` selects at the three pinned snapshots) → `scripts/record_llm.py` (OpenAI outputs, so `tests/test_golden_live_replay.py` executes offline). `PubMed_get_article` cassettes are keyed by the exact PMID batch, so whenever L4 ranking, cap, dedup, dynamic focus or selection changes, re-run `record_literature.py` before `record_llm.py`; `record_llm.py` refuses to record a snapshot that read no abstracts, and `test_literature.py` fails on that drift.
- `ELUTE_DEMO_DISABLE_TOOL=literature` demonstrates recovery transparently; the trace says the call was intentionally disabled.
