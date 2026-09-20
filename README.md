# elute

Drug-repurposing decision support that always shows the case against.

Given a condition, an approved drug, or a drug–condition pair, elute organizes the evidence the way a skeptical scientist would: the strongest objections first, every link in the mechanism labeled **established / contested / single-source / unknown / refuted** with its sources one click away, safety as a reason rather than a banner, the five prerequisites a trial would have to assume, the scientist's own call in their own words, and the agent's thought process as a ledger — what each step reasoned, why, and on what evidence. It never recommends. Built for one user, the accountable translational scientist, for the Regeneron challenge at HackMIT 2026. The product is specified in `PRD Elute.md` (v2.2).

To elute is to wash a mixture through a column so its compounds come out one at a time, separated. The tool does the same to a hypothesis: what is known comes apart from what is merely believed.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

No keys, no server: by default the app runs on curated fixtures. The one live surface is the pathway panel on Detail, which asks Open Targets and Reactome in the browser and falls back to STRING, then to the chain alone, if either is unreachable. `npm run build` produces a static bundle in `dist/` that deploys to any static host (`vercel.json` and `public/_redirects` handle deep links). `npm test` runs the unit tests, including the nilotinib backtest.

### With the backend

```sh
cd backend
uv sync --extra dev
uv run uvicorn elute.main:app --port 8000   # ELUTE_MODE=fixture by default; ELUTE_MODE=live for the real pipeline
uv run pytest                               # 119 tests, offline on recorded cassettes
```

Then from the repo root: `VITE_ELUTE_API=http://localhost:8000/api npm run dev` (or put that line in `.env.development.local`, which is gitignored; Vite restarts on its own). The frontend switches from `FixtureSource` to `ApiSource` (`src/data/api.ts`) over the same `DataSource` seam; nothing else changes. Fixture mode needs no key. Live mode runs the three ToolUniverse tools (Open Targets, ClinicalTrials.gov, Europe PMC) with direct API fallbacks and degrades honestly without `OPENAI_API_KEY` (`llm: unavailable`, never an abort); with `ELUTE_LLM_CASSETTES=tests/fixtures/llm` in `backend/.env` and no key, recorded OpenAI outputs are replayed by prompt hash, reused only when the prompt is byte-identical. Details in `backend/README.md`.

### The research stage, and the recorded demo

While a live run works, the Working page says up front how long it expects to take and on what basis (the last recorded run that touched the network, else defaults), keeps a clock and a remaining-time estimate, shows the last line each step said inside its box, and under the grid the step's thought process as the backend emits it: why this step, the evidence it needs, the tool and why, the lines it said while running, what came back, what that changed, and what comes next, with who worded the reasoning (template or model) always stated. Everything the page showed is kept in this browser (`localStorage`, `src/lib/runlog.ts`), so *2 research* on the rail reopens the stage as it settled, and a reload or a backend that has gone away still shows it. A fresh ask from Entry runs the stage again.

Every completed live run is also written by the backend to `public/demo/<slug>.json` (plus `runs/` and an `index.json`), a folder that is gitignored. Entry always offers the hard-coded example under *try:* (`nilotinib for Parkinson’s`, typed or clicked): the fixture's scripted sequence and the curated nilotinib record, in either mode, with no backend needed. When a recording exists it is offered beside the example worded exactly as it was asked, and choosing it replays the real run's events, compressed to about 24 s with each step keeping its share of the time (`src/data/session.ts`); a recording asked in the example's own words takes the example's place. In fixture mode a recording replaces the scripted sequence for its pair; in live mode typing any other pair starts a real run. The backend's payload cache (`backend/.cache/payloads`) answers rehearsed queries instantly; move it aside before recording a run whose timings should be real.

One ask is hard-coded: typing the example as written, `nilotinib for Parkinson’s` (either apostrophe), runs the fixture's scripted sequence for the curated pair in either mode and opens the curated appraisal, with no backend needed; the page says it is a scripted sequence. In live mode, `nilotinib for Parkinson’s disease` is a real run.

## The flow

| Screen | Route | What it does |
|---|---|---|
| Appraise | `/` | Under the five stages (centred under the header on every page, the current one in ink): `prove it to me`, one field for a drug, a condition, or a pair, and three example words |
| Working | `/q/parkinsons-disease` | Ten checks as ten boxes that light up one at a time, each with its question, its source and what came back; the current step's records arrive beneath |
| Detail | `/q/parkinsons-disease/nilotinib` | Critical appraisal; the pathway panel (below); the mechanism chain with a label on every link and the weakest link marked; safety in the likely trial population; the five prerequisites a trial would assume; your call |
| Pathway | on Detail | The hypothesis drawn as biology: the drug in the blood, the barrier it must cross, the molecules it acts on in the brain, the outcome in the patient. Inhibition is a bar, phosphorylation a circle, transport a diamond. Every action of the hypothesis is weighted and labelled by the evidence rules and opens its claim's evidence when selected; background biology is grey. Beside it, Reactome's own diagram of a pathway the target is actually filed under, muted, the target flagged. Under both, the fine print: where the target sits, whether it is tractable, the route, what the drug has to cross, and what the target is filed under. Live from Open Targets and Reactome; for nilotinib it says "ABL1 appears in 13 curated Reactome pathways. None is this hypothesis." Records without a drawing get the chain as a line. |
| Evidence as of | `…/nilotinib?asof=nov-2017` | Freeze the page at a date. At Nov 2017 — the day NILO-PD enrolled its first patient — the three pre-trial objections are on screen and none of the post-trial ones. This is the backtest as an interaction. |
| Sources | `/q/parkinsons-disease/sources` | The run's ledger with every record, the tool calls, the packages, and the rules that assign each label |
| Export | `…/nilotinib/export` | Markdown, JSON, or print, with a live preview; the evidence date and the data note travel with the document |

## How labels are assigned

Every claim in a chain carries dated evidence. At a chosen date, only evidence published on or before it counts, and the label is derived by six ordered rules (override with a stated reason → unknown → refuted → contested → established → single-source). The rules are printed under *Status rules* on the Sources page and implemented in `src/lib/evidence.ts`; the nilotinib chain's fifteen expected labels across three dates are pinned in `src/lib/evidence.test.ts`.

## What is curated and what is not

- **Nilotinib for Parkinson's disease** is hand-curated from dated primary sources (Pagan 2016, Reinwald 2014, Schwarzschild 2016, Simuni 2021, and the mechanism literature), with three evidence dates.
- **The other candidates** (ambroxol, exenatide, isradipine, simvastatin; metformin for Parkinson's, Alzheimer's and colorectal adenoma) are **drafts**: structurally complete, entered from memory of the literature, not yet verified against the papers. They are marked *draft* in the interface and listed on the Sources page. Where a citation is uncertain the link is a PubMed search rather than an identifier.
- **The ledger** in fixture mode is a scripted sequence with real source names, not a recorded live run; the interface says so. Against the backend it is a recorded run: Phase 1 of `docs/BACKEND_PLAN.md` (v4.4) is implemented for the nilotinib vertical slice — three verified ToolUniverse tools with direct API fallbacks, a deterministic evidence engine, OpenAI at bounded and cited steps, an `as_of` backtest at three pinned dates, and an evidence-grounded opinion. The adapter's output passes the frontend's own `validateCandidate` (`scripts/validate-detail.ts`). Phase 2 (OpenAlex citation independence) has not started.
- **The pathway panel is live.** Targets, Reactome pathway memberships, tractability and subcellular location come from the Open Targets GraphQL API at view time; the diagram is Reactome's exporter; STRING is the fallback picture. Only the drug → target link is ever marked as curated (ChEMBL mechanism of action); every later link is labelled "not curated" and stands on its cited papers. Route and barrier are from the record.
- **Safety** is read from the FDA label in both modes: the boxed warning (or its absence), every warning with the body system it names, the contraindications, and at the run date the FAERS signals Open Targets ranks; the fifth prerequisite (boxed → *with monitoring*) and the Safety block on Detail are derived from that one dated record. When the label version read is dated after the selected evidence date the page says so rather than showing a flag; *not assessed* now means no label was found at all.
- **The five prerequisites** on `main` are the v1 five; PRD v2.2 renames them (brain exposure at tolerated doses · target engagement measured in patients · benefit under blinding · biomarker validated against an alternative · safety acceptable in the likely population). The backend adapter already emits the v2.2 five (`backend/elute/api/adapt.py`); the fixtures and frontend copy are renamed in one joint PR.

The Sources page and every export carry the data note. This is not a medical device, not a clinical decision tool, and not a prescribing aid.

## The exams we hold ourselves to

> **Design.** A domain expert who has never seen the tool, shown the Detail view for one candidate, can within two minutes and without being told what to decide (a) state the strongest argument against the candidate and (b) name its weakest evidentiary link.

Three people who did not build the interface, the nilotinib case, verbatim answers, pass = 2 of 3 on both. **Result: not yet run.** It will be reported here either way.

> **Recognition.** A scientist looks at the pathway drawing and says *"that's a known pathway"* or *"that's novel"* without being told.

**Result: not yet run** (the drawing is not yet on `main`).

## Layout of the repo

```
PRD Elute.md                 the product requirements document, v2.2 — the truth
CLAUDE.md                    project context: what elute is, principles, state of the build
docs/BACKEND_PLAN.md         the backend plan, v4.4 FINAL; Phase 1 implemented
docs/sponsor-conversations.md what the sponsor judge asked for
docs/tooluniverse-spike.md   the ToolUniverse spike: which tools were verified and how
DESIGN.md, design/           the design system: type, color, 8px grid, the shard, the paper material
docs/redesign/               the 20 Sep notes, screenshots (shots/restore is the current state), shot scripts
docs/superpowers/specs/      the frontend design spec (v4) and its review history
src/data/types.ts            the fixture contract a backend fills
src/data/source.ts           the DataSource seam; FixtureSource replays bundled JSON
src/data/api.ts              ApiSource: the same seam over the backend's HTTP/SSE, on when VITE_ELUTE_API is set
src/lib/evidence.ts          label rules, cutoff filtering, ordering, publishability
src/lib/pair.ts              drug–condition pair parsing for the entry field
src/fixtures/                nilotinib (curated), drafts, ledgers, papers, provenance
src/screens/                 Entry, Query (Working), Detail, Sources, Export
backend/                     FastAPI + ToolUniverse pipeline (uv); fixture and live modes; cassette-backed tests
scripts/validate-detail.ts   checks the backend adapter's output against the frontend validator
```

MIT license.
