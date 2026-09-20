# elute

Drug-repurposing decision support that always shows the case against.

Given a condition, an approved drug, or a drug–condition pair, elute organizes the evidence the way a skeptical scientist would: the strongest objections first, every link in the mechanism chain labeled **established / contested / single-source / unknown / refuted** with its sources one click away, safety as a reason rather than a banner, the prerequisites a trial would have to assume, and the scientist's own call in their own words. It never recommends. Built for the Regeneron challenge at HackMIT 2026.

To elute is to wash a mixture through a column so its compounds come out one at a time, separated. The tool does the same to a hypothesis: what is known comes apart from what is merely believed.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

No keys, no server, no network: v1 runs entirely on curated fixtures. `npm run build` produces a static bundle in `dist/` that deploys to any static host (`vercel.json` and `public/_redirects` handle deep links). `npm test` runs the unit tests, including the nilotinib backtest.

## The flow

| Screen | Route | What it does |
|---|---|---|
| Appraise | `/` | One field for a drug, a condition, or a pair; three mode examples; paste a paper (PMID, DOI, abstract) and see what was read before anything runs; recent appraisals |
| Working | `/q/parkinsons-disease` | The evidence ledger builds step by step, each naming its source and what came back; finished steps open beside it; one step shows a retry |
| Results | same route | Candidates grouped into *not yet refuted* and *refuted in controlled studies*, ordered by fewest unresolved trial prerequisites — never by a score. List or board (by trial stage). |
| Detail | `/q/parkinsons-disease/nilotinib` | Critical appraisal, the mechanism chain with a label on every link and the weakest link marked, safety in the likely trial population, the five prerequisites a trial would assume, your call |
| Evidence as of | `…/nilotinib?asof=nov-2017` | Freeze the page at a date. At Nov 2017 — the day NILO-PD enrolled its first patient — the three pre-trial objections are on screen and none of the post-trial ones. This is the backtest as an interaction. |
| Sources | `/q/parkinsons-disease/sources` | The run's ledger with every record, the tool calls, the packages, and the rules that assign each label |
| Export | `…/nilotinib/export` | Markdown, JSON, or print, with a live preview; the evidence date and the data note travel with the document |

## How labels are assigned

Every claim in a chain carries dated evidence. At a chosen date, only evidence published on or before it counts, and the label is derived by six ordered rules (override with a stated reason → unknown → refuted → contested → established → single-source). The rules are printed under *Status rules* on the Sources page and implemented in `src/lib/evidence.ts`; the nilotinib chain's fifteen expected labels across three dates are pinned in `src/lib/evidence.test.ts`.

## What is curated and what is not

- **Nilotinib for Parkinson's disease** is hand-curated from dated primary sources (Pagan 2016, Reinwald 2014, Schwarzschild 2016, Simuni 2021, and the mechanism literature), with three evidence dates.
- **The other candidates** (ambroxol, exenatide, isradipine, simvastatin; metformin for Parkinson's, Alzheimer's and colorectal adenoma) are **drafts**: structurally complete, entered from memory of the literature, not yet verified against the papers. They are marked *draft* in the interface and listed on the Sources page. Where a citation is uncertain the link is a PubMed search rather than an identifier.
- **The ledger** is a scripted sequence with real source names, not a recorded live run; the interface says so.

Every screen carries a data note. This is not a medical device, not a clinical decision tool, and not a prescribing aid.

## The test we hold ourselves to

> A domain expert who has never seen the tool, shown the Detail view for one candidate, can within two minutes and without being told what to decide (a) state the strongest argument against the candidate and (b) name its weakest evidentiary link.

Three people who did not build the interface, the nilotinib case, verbatim answers, pass = 2 of 3 on both. **Result: not yet run.** It will be reported here either way.

## Layout of the repo

```
PRD Elute.md                 the product requirements document
DESIGN.md, design/           the design system: type, color, 8px grid, the shard, glass
docs/superpowers/specs/      the frontend design spec and its review history
src/data/types.ts            the fixture contract a backend fills
src/data/source.ts           the DataSource seam; FixtureSource replays bundled JSON
src/lib/evidence.ts          label rules, cutoff filtering, ordering, publishability
src/fixtures/                nilotinib (curated), drafts, ledgers, papers, provenance
src/screens/                 Entry, Query (Working → Results), Detail, Sources, Export
```

MIT license.
