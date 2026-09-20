# Elute — frontend design (v1, fixture mode)

**Date:** September 19, 2026 · **Status:** v4 — v3 plus the flow revision in §16, which supersedes §§3–5 where they differ · **Scope:** the frontend for the Regeneron-track demo, running on curated fixtures, built so a backend can replace the fixture source without changing screens.

**Sources of truth, in order:** `PRD Elute.md` (flow, copy, cut) → the Figma mockup (`oXHypg8b6ZzUavBffDq7MO`, frames *Desktop - 1* and *Desktop - 2*: composition) → `DESIGN.md` and `design/` (type, color, grid, glass, motion). Where they conflict, the earlier one in this list wins, and §11 lists the DESIGN.md edits that follow.

---

## 1. What we are optimizing for

The Regeneron rubric (regn.link/hackmit, H. Wei v1.0) weights five things. The frontend answers each:

| Criterion | Rubric wording that matters | What the frontend does about it |
|---|---|---|
| Readiness | *"Is **all** the functionality actually working?"* | Every visible control works. Should-tier items not built are cut, not stubbed. Candidates that are not fully curated are not shown. Fixture mode runs with no keys, as a static bundle. |
| Utility | *"How would it actually help real users?"* | Detail is the product: critical appraisal, labeled chain, trial prerequisites, the scientist's own assessment. |
| Design | *"Obvious and intuitive what to do and how to accomplish objectives"* | The PRD §3 test: a naive expert states the strongest objection and the weakest link within two minutes of Detail loading. Detail stands alone. |
| Relevance | *"Relevant to Regeneron pipeline, e.g. cancer therapeutics"* | Hero disease is Parkinson's (Regeneron neuroscience); hero drug nilotinib is an oncology drug (CML). Both are stated on the row and the Detail header. |
| Packaging | *"Publicly-linked cloud demo instance"*, docs, ≤10 slides | Static deploy of fixture mode; deep links to every screen; `/methods` page; print and clipboard exports that carry the disclosure. |

Starter sheets the UI is designed against: **Scientific credibility** (labels show design, n, blinding, replication — "methodology scrutiny" made visible), **Structural reasoning** (the mechanism chain is a walkable list of dependent claims, each opening to its evidence, not prose), **Agentic orchestrator** (the ledger shows tool outputs and one visible self-correction), **AECausality** (*unknown* is a first-class label; the tool says which way it errs).

The PRD's own rule: *if we ship one screen, it's Detail.* Build order (§12) follows that.

## 2. Decisions

Sixteen decisions taken with the product owner on Sept 19, then adjusted where the Codex review (§15) showed a decision could not be built as stated. Each is a deliberate call; the implementation plan must not reopen them without cause.

| # | Decision | Chosen | Why |
|---|---|---|---|
| 1 | PRD vs DESIGN.md conflicts | PRD wins; DESIGN.md updated (§11) | PRD §14 revised the older `user_journey.txt` flow DESIGN.md was written against. |
| 2 | Navigation | Routed pages; persistent header field on inner pages; a 384px rail **on Detail only** | Detail keeps the whole viewport for the §3 test; the metformin "second path" types into the same field; deep links make the demo reliable. Results has no rail because the row cannot fit beside one (§15, R3). |
| 3 | The Figma panel | One rounded **solid** sheet per page (32px radius, soft shadow, no glass) | Honors the mockup; keeps glass off reading surfaces; inside the sheet everything stays sharp rows and 1px lines. |
| 4 | Entry layout | Sentence + field in the white band; three example chips as glass pills over the shard; worked appraisal below | A text input stays legible on white; chips are buttons, which the glass library does well; the one glass-meets-brand moment survives. |
| 5 | Driver bar | PRD driver bar, four named segments, three monochrome pips each; refuted clinical segment is the only raspberry; never a number | The brief's first anti-pattern is a bare score; the bar shows what set the rank. Words label every segment. |
| 6 | Evidence as of | Sticky solid segmented control at the top of Detail; one italic line states the frozen date; the cutoff filters **every** evidence-bearing surface on the page (sections, rail, export); Detail only in v1 | The backtest as an interaction; not a control over decoration, so not glass; Results re-ordering by date is deferred. |
| 7 | Refuted label | Raspberry word, **solid** line | Settled evidence with a negative sign: the solid line of *established* in the color of weakness. Single-source keeps raspberry + dashed; the word disambiguates. |
| 8 | Chain | Static DOM chain of **ordered claims** (each step is one claim with its own label and evidence; arrows mean *depends on*), **vertical** (top to bottom, drug to condition), one glass filter pill (All · Contested · Single-source · Refuted); no pan/zoom | The PRD's "each link one claim" is a checklist of dependent claims, not a graph whose arrows carry evidence (§15, S3). Five labeled claims must fit beside the rail at 1280px; vertical gives every claim a full-width line, so the weakest link is a whole line. Changes DESIGN.md's "left to right" and "links carry the label" (§11). |
| 9 | Ledger | Fills the sheet while running, then collapses into one disclosure line above the results; on Detail it lives in the rail; replay is accelerated and says so | "Never disappears" without pushing results below the fold or crowding the row. |
| 10 | Provenance | Expandable ledger rows + a static `/methods` page; no raw-JSON toggle | Citation system, not debug output. Methods + manifest serve the IT reviewer. |
| 11 | Export | *Copy as document* (Markdown to clipboard) + *Print*, both from **one export model** that carries the evidence date and the data disclosure | The argument survives outside the tool with its qualifications intact. |
| 12 | Scope cut | In: mechanism × clinical scatter. Out: paste-a-paper tab, evidence board, narrow-screen layout. **Minimum width 1280** | Readiness: nothing visible that doesn't work. Scatter is the thesis as a picture. 1280 is the smallest width at which the populated Results row and Detail-with-rail lay out without wrapping into illegibility. |
| 13 | Stack | Vite + React + TypeScript; plain CSS with the existing tokens (CSS Modules per component); React Router; no Tailwind | The tokens already are the system; static bundle for the cloud demo. |
| 14 | As-of model | Every claim carries its publication date; the UI filters by cutoff and derives labels from visible evidence by stated rules, with curated overrides that must carry a *why* | One fixture; the backtest rule is enforced by data; inspectable. |
| 15 | Glass order | CSS fallback first; WebGL liquid-glass as a late enhancement behind the WebGL / reduced-transparency check | Zero risk to Readiness; same markup either way. |
| 16 | Data banner | One 32px line directly under the header on every screen, not dismissible | Visible on a projector without scrolling; the mode word changes when a backend lands. |

Two smaller calls made while writing this spec, open to challenge:

- **Results are rows, not cards.** The PRD lists nine card elements; DESIGN.md says rows with 1px lines. Content from the PRD, form from DESIGN.md: a three-line row (§5.5).
- **Rank numbers use Supreme with `.figure`**, not monospace. The PRD asked for monospace to keep scan order aligned; right-aligned lining figures do that and keep mono for provenance only.

## 3. Information architecture

```
/                          Entry
/q/:query                  Working (ledger replay) → Results (same route, same sheet)
/q/:query/:candidate       Detail            ?asof=<cutoff id>
/methods                   Methods + dependency manifest
```

- `:query` is a resolved entity slug, never raw text: `parkinsons-disease`, `metformin`, or a pair `nilotinib--parkinsons-disease`. The field resolves text to a slug through the fixture's entity index (§7.1); unresolvable text never navigates (§4.1).
- A **pair** query runs the ledger, then lands on Detail directly (Results would have one row). The rail on that Detail holds the ledger. The pair Detail's candidate bar carries a *← All candidates for Parkinson's disease* link so the pair path is not a dead end.
- **History semantics.** Route changes push history. Changing `?asof=` **replaces** the current entry (the date is view state, not a navigation step), so Back from a Detail always returns to where the Detail was opened from. Opening a row from Results opens Detail at *Today* (no `asof` param). The candidate bar's back link reads *← Results · as of today* so a judge who moved the date knows the list they return to is the *Today* order.
- Ledger replays run once per query per session (in-memory cache). Results → Detail → back does not replay. A deep link into Detail or Results shows the completed ledger without replaying.
- Every route renders the header (§5.1), the data banner (§5.2), and one sheet (§5.3). Detail adds the rail (§5.4).
- Only **publishable** candidates (§7.5) appear anywhere: the entity index, Results, the scatter, and routes. An unpublishable candidate's URL is treated as unknown (§8).

### The demo script, as routes

1. `/` — type *Parkinson's disease*, or press the chip.
2. `/q/parkinsons-disease` — ledger fills the sheet (~12 s, labeled accelerated), collapses to one line; six rows appear, ambroxol first, nilotinib fourth.
3. `/q/parkinsons-disease/nilotinib` — Critical appraisal, chain, safety, prerequisites, assessment.
4. `?asof=nov-2017` — the aha. `?asof=jul-2016` — the MAO-B objection is absent.
5. Header field → *metformin* → `/q/metformin`.
6. Any `[L6]` citation → rail shows the provenance row, filtered to the cutoff.
7. `/methods`.

## 4. Screens

### 4.1 Entry (`/`)

Composition from Figma *Desktop - 1*: a white band, then the shard filling the viewport.

- **White band, 280px** (Figma 279, snapped). Wordmark *elute* in Aujournuit Airy at 96px, tracking −2%, left gutter 80px (Figma 76, snapped). To the right of the wordmark, vertically centered: the one sentence in `--text-lg` — *Approved drugs that might treat something else — and the strongest case against each one.* — and beneath it the field: 48px tall, 640px wide, sharp corners, 1px `--color-line`, placeholder *a drug, a condition, or a drug and a condition*. The data banner (§5.2) is the band's last 32px.
- **Field behavior.** Typeahead from the fixture entity index: as the user types, up to six matches drop down (name · *condition* / *drug* / *pair*, in `--text-sm`). Enter or click on a match navigates. Enter on text with no match does not navigate; one line appears under the field in the annotation style: *Not in the curated set. Fixture mode covers Parkinson's disease, metformin, and nilotinib for Parkinson's.* The rubric's "all functionality working" is met by never presenting a dead end as a search.
- **Shard hero.** The 12-path SVG from the mockup (four brand colors), inline, `preserveAspectRatio="xMidYMid slice"`, filling the viewport below the band (min 640px). Over its top-left, inset 32px: **three example chips** as one pill container with three pill buttons, 40px tall — *Parkinson's disease* · *metformin* · *nilotinib for Parkinson's*. They teach the three modes by example; no mode labels. Glass per §9.
- **Worked appraisal, below the shard.** Heading in `--text-lg`: *What an appraisal looks like.* Then the nilotinib Critical appraisal section (§4.3, at *Today*, first three objections) rendered by the same component, read-only, in a sheet, followed by one link: *Open the full appraisal →* (`/q/parkinsons-disease/nilotinib`). The user sees that the tool leads with objections before they type.

### 4.2 Working → Results (`/q/:query`)

One route, one sheet, two phases. No rail.

**Working phase.** The sheet's heading is the resolved query in Aujournuit `--display-md` (*Parkinson's disease*), with the resolved identifier under it in the annotation style (*MONDO:0005180 · resolved via Open Targets*). Below, the **evidence ledger**: rows rise in one at a time (transform + opacity, 240ms, ease-out, staggered by the replay timing) and stay. Each row is one line on the grid, in Supreme:

```
L1   Resolve the query            Open Targets · MONDO        1 record      2.1 s   ▸
L2   Disease → targets            Open Targets Platform       38 targets    3.4 s   ▸
...
```

Columns: id (`.figure`, faint) · step · source · what came back · recorded elapsed (only when the ledger is `recorded`, §7.2) · disclosure. *What came back* is always **derived**: the count of the row's `records` visible at the current cutoff (Results and Working are always *Today*), phrased with the row's `unit` (*38 targets*, *14 trials*). A finished row is expandable immediately, even while later rows are still arriving; expanding shows the provenance block (§5.6). One row in the Parkinson's fixture shows a **self-correction**, rendered from its `retry` execution metadata before the derived count: `L5 Registered trials · ClinicalTrials.gov v2 · 0 records → retried with MONDO:0005180 · 14 trials`. The retry carries no count of its own, so a historical view of the same row derives a historical count. A running row shows its step and source with the result column reading *…*; no spinner anywhere. Rows for steps that have not started are not rendered.

**Replay timing and honesty.** Playback lasts ≈ 12 s. For a `recorded` ledger, per-row playback is the recorded `elapsed_ms` scaled by one constant, and the row's elapsed column shows the *recorded* value, so the ledger's figures stay honest to the real run. For a `scripted` ledger there is no elapsed column. The banner (§5.2) says which: *accelerated replay of a recorded run (74 s shown in 12 s)* or *scripted sequence · not a live run*. Nothing on screen implies the tool runs in 12 s.

**Results phase.** On the last row's arrival, the ledger rows collapse (240ms height change) into one disclosure line at the top of the sheet — *Evidence ledger · 10 steps ▸* — and the results list rises in beneath it. The disclosure expands inline to the compact rows (id · step · what came back · ▸), each expandable to its provenance block. Under the disclosure, one line in the annotation style, with the actual date so a judge returning from a historical Detail sees which evidence set ordered the list: *Ordered by fewest unresolved trial prerequisites as of 19 Sep 2026 (fixture date) — not by a score.* A two-tab control on the same line, right-aligned, solid: **List · Scatter**.

**Results row** (§5.5), six for Parkinson's once all six are publishable; fewer until then, with the same ordering line. Click anywhere on the row opens Detail; the name is the link for keyboard users.

**Scatter tab.** One SVG in the sheet, 800×480 on the grid. **x**: mechanism support, the driver bar's mechanism pips, 0–3. **y**: clinical test status, an ordinal with five named levels mapped exhaustively from `best_evidence` at *Today* (`controlled` × `outcome`):

| `controlled` | `outcome` | y level (ascending) |
|---|---|---|
| true | negative | 0 · *controlled negative* |
| false | negative | 1 · *uncontrolled negative* |
| any | none | 2 · *no human test* (validation requires `controlled: false` here) |
| false | positive or mixed | 3 · *uncontrolled positive or mixed* |
| true | positive or mixed | 4 · *controlled positive or mixed* |

Axis labels are those words; there are no quadrant captions, because two candidates at *no human test* and *controlled negative* would share a quadrant under any caption scheme. A legend under the chart states the five levels in one line. Points are 8px ink squares (sharp), labeled with the candidate name in `--text-sm`; a *controlled negative* point is raspberry. Points with identical coordinates are offset 16px apart horizontally in name order; each point is a separate focusable link to Detail. The thesis the PRD wants is read directly: nilotinib sits at mechanism 3, *controlled negative*.

**Drug-first query** (`/q/metformin`): identical structure; rows are conditions (*Parkinson's disease*, *…*) and the drug's class and approved indication appear once under the heading instead of per row. The PRD's promise: plausible for several conditions and weak for all of them; the 2025 PD pilot (n = 60, no UPDRS difference) sits on that row's best-evidence badge.

### 4.3 Detail (`/q/:query/:candidate`)

The screen the §3 test is run on. Everything below is inside the sheet unless it says rail. **Every evidence-bearing element on this page — sections 1–4, the rail, the export — is filtered by the selected cutoff (§7.3).**

**Candidate bar, sticky.** A back link above it in `--text-sm`: *← Results · as of today* (or *← All candidates for Parkinson's disease* on a pair query). Two lines: the candidate name in Aujournuit `--display-md` (*Nilotinib*), then class · approved indication · *for* condition in `--text-sm` muted (*BCR-ABL tyrosine kinase inhibitor · approved for chronic myeloid leukemia · for Parkinson's disease*). Right-aligned on the same block: the **Evidence as of** control (§5.7). Under the bar, one italic line from the cutoff's `note`: *Evidence frozen at 20 Nov 2017 — the day NILO-PD enrolled its first patient.* At *Today*: *Evidence as of 19 Sep 2026 (fixture date).* The bar sticks to the top of the viewport when the page scrolls (the page header does not).

Measured fold at 1440×1024: header 184 + banner 32 + gap 24 + sheet padding 48 + candidate bar 136 + section gap 32 + heading 32 = objection 1 starts at y ≈ 488; four three-line objections end at y ≈ 824. On a 1440×900 laptop, three objections are visible without scrolling.

**1. Critical appraisal.** Heading in `--text-lg`. Numbered objections ordered by consequence, each a block on the grid:

- Line 1, Supreme Medium: the objection in one sentence. *Brain exposure at tolerated doses is very low.*
- Line 2, Regular: the evidence in one sentence, with the one figure that carries the argument in Bold. *CSF/plasma ratio **0.53 %** (range 0.23–1.5 %) in CML patients with CNS relapse.*
- Line 3, annotation: source · study design · n · date · `[L8]`. The citation opens the ledger row in the rail.

Objections whose `published` date is after the cutoff are not rendered, and **nothing indicates that any exist** — no count, no placeholder. The frozen-date line and the changed content are the feedback that the control worked. (Codex R5: a count reveals that later adverse evidence exists, which the historical scientist could not know.)

**2. Mechanism chain.** Heading, then one sentence in the annotation style that tells the reader what the chain is: *For the hypothesis to hold, each of these must be true. Each claim carries the status of its own evidence.* Then the chain (§5.8) with the glass filter pill floating over the chain block's top-right corner. Claims read top to bottom, drug to condition. The weakest claim's row carries *weakest link* in raspberry `--text-sm` followed by its curated one-sentence reason. Selecting a claim (click or Enter) opens it in the rail (§5.4).

**3. Safety as a reason.** Rendered only when the candidate has a boxed warning or a population-specific safety argument visible at the cutoff. Heading *Safety in the likely trial population*. One block: the warning as a raspberry word with its reason beside it (*QT prolongation — boxed warning*), then two sentences on what it means for the trial you would have to run (older, polypharmacy Parkinson's population; ECG monitoring; exclusion criteria), then the source line. No banner styling; `--color-surface-critical` is not used here.

**4. Trial prerequisites.** Five rows on 1px lines: condition (Medium) · status word (Regular: *not shown* / *no* / *none* / *contested* / *with monitoring*) · one sentence · citation. Status comes from the prerequisite's timeline at the cutoff (§7.3). The heading states the count at the selected cutoff and, when the cutoff is not *Today*, says so: *Trial prerequisites — 4 of 5 unresolved* / *— 3 of 5 unresolved at this date*. The Results order always uses the *Today* count (§7.3).

**5. Your assessment.** Three radio choices as 40px solid pills, one row: *pursue* · *needs specific data* · *deprioritise*; then a one-line text input, 48px, placeholder *In your words.* Saved to `localStorage` under `assessment:<query>/<candidate>@<cutoff>` — **one assessment per cutoff**, so a judgment entered against *Today*'s evidence never appears under a historical date (Codex R9). Switching the cutoff shows that cutoff's assessment, empty if none. No submit. Beside it, right-aligned: **Copy as document** (primary, ink) and **Print** (secondary). The tool never pre-selects a choice.

**Rail** (§5.4) defaults to the collapsed ledger, filtered to the cutoff. A citation or a link selection replaces the rail's content with that item and a *← Ledger* line at the top. When the cutoff changes while an item is open, the item re-renders under the new cutoff; if it has no visible content at the new cutoff (an objection's only source is later than the cutoff), the rail returns to the ledger.

### 4.4 Methods (`/methods`)

A reading page in the sheet, no rail. Generated from the fixture and `package.json` at build time:

1. *Methods.* One paragraph per ledger step: the tool, the endpoint, the query template, what is extracted and how it is classified (study design classifier rules; label derivation rules from §7.3 in prose).
2. *Label rules.* The five labels and the rule that assigns each, stated once, plus the note that hero-case links may carry a curated label with its stated reason.
3. *What is curated and what is synthetic.* The fixture's `provenance` block verbatim: which candidates are hand-curated from dated sources, which values are synthetic, whether the ledger is recorded or scripted, and the real data sources a production run would use (Open Targets, ChEMBL, PrimeKG/Reactome, ClinicalTrials.gov v2, PubMed/Europe PMC, openFDA/FAERS, All of Us).
4. *Dependencies.* A table from `package.json`: name, version, license. And the vendored liquid-glass-js commit.
5. *What this is not.* The PRD §11 statement.

## 5. Components

Named as they will be implemented. Each has one purpose, a typed props interface, and no knowledge of the data source.

### 5.1 Header (inner pages)

From Figma *Desktop - 2*, snapped to the grid: **184px** tall (Figma 181). Left block on `--color-surface`, 512px wide: the wordmark in Aujournuit Airy at 64px (top 32px), and beneath it the persistent field, 40px tall, 384px wide, same typeahead as Entry. The shard band fills the rest of the header's width and height, the SVG cropped with `slice` and offset so the composition's dense center shows (Figma offsets the group up by 563px). Not sticky. The wordmark links to `/`.

Entry uses the 280px white band instead (§4.1).

### 5.2 Data banner

32px, full width, `--color-surface-sunken`, annotation style, one line, directly under the header on every route. Text is composed from the data source's `mode`, the ledger `kind`, and the fixture's `provenance.summary`:

> *Fixture mode · curated from dated public sources; values marked synthetic are. In production this would run on Open Targets, ChEMBL, ClinicalTrials.gov, PubMed, openFDA and All of Us. Not a clinical decision tool.*

During and after a ledger replay on `/q/:query` the first phrase becomes *Fixture mode · accelerated replay of a recorded run (74 s shown in 12 s)* or *Fixture mode · scripted sequence, not a live run*, per §7.2. Not dismissible, no close control, no raspberry.

### 5.3 Sheet

The page's one container. `--color-surface`, `--radius-sheet: 32px`, `--shadow-sheet: 0 4px 10px oklch(13.1% 0.016 276 / 0.25)` (the Figma value in the ink hue; tune down toward 0.12 if it reads heavy on a projector), padding 48px, margin-top 24px from the banner, left gutter 80px, right gutter 80px (Results, Methods, Entry's worked appraisal) or 24px to the rail (Detail). Inside the sheet, corners are sharp and surfaces are white; there is never a second sheet inside it.

Widths, content area = sheet − 96px padding:

| Viewport | Results / Methods sheet | Detail sheet (with 384px rail + 24 gap + 32 right gutter) |
|---|---|---|
| 1280 | 1120 → 1024 content | 760 → 664 content |
| 1440 | 1280 → 1184 content | 920 → 824 content |
| 1920 | 1760 → 1664 content, list capped at 1280 | 1400 → 1304 content, prose capped at 65ch |

### 5.4 Rail (Detail only)

384px (`--panel-detail`), on the page surface (not a sheet), 1px `--color-line` on its left, sticky under the banner, scrolls independently. Everything it shows is filtered by the cutoff. Three contents, one at a time:

- **Ledger (default):** heading *Evidence ledger · 10 steps*; the rows from §4.2 in compact form (id · step · what came back), each expandable to its provenance block (§5.6). A row's `what came back` figure is the count of its records visible at the cutoff.
- **Citation:** the one ledger row, expanded, with *← Ledger* above it.
- **Claim evidence:** for a selected chain claim (§5.8): the claim in Medium; the label word with its color and qualifier; *Why this label* in one sentence (curated `why` if an override applies, otherwise generated from the rule that fired — *One group reports this in an open-label study of 12; nothing published before this date replicates or contradicts it.*); then *Who says so* (each visible supporting source: first author · journal · year · design · n · blinded · `[Ln]`); then *What argues against* (visible contradicting or refuting sources, same form, or *nothing published on or before this date*); then the *Weakest link* reason when applicable.

Selection is component state and does not survive reload; the cutoff is URL state.

### 5.5 Results row

Three lines on the grid, 16px padding above and below (row height 104px), 1px `--color-line` between rows, no hover background (hover underlines the name; focus shows the slate ring). Column contract: a rank column of 48px (`.figure`, faint, *04*) with a 16px gap spans all three lines; lines 1 and 2 share a flexible main column and a right-aligned figure block of 192px; **line 3 spans the full width after the rank column** (the figure block does not exist on line 3). All gaps are 16px.

- **Line 1.** Name in Medium · class · *approved for* indication (muted, `--text-sm`; truncates with an ellipsis only when the main column is narrower than 640px, which does not occur at or above 1280). Right block: *4 of 5 prerequisites open* in Regular.
- **Line 2.** *Weakest link:* in raspberry Medium followed by its text in Regular (*CNS exposure — CSF/plasma 0.53 %*). Right block, muted `--text-sm`: *12 sources · 3 trials*. This is the row's most important line (PRD Principle 4) and gets its own line so it never wraps against a column.
- **Line 3.** Best-evidence badge, 192px (design · outcome · n with an 8px status square: *RCT · negative · n = 76* ■) · driver bar, 248px (§5.9) · mechanism one-liner in `--text-sm` muted, flexible with a **minimum of 256px** (*nilotinib → ABL1 → α-synuclein clearance* measures ≈ 220px in Supreme at 14px) · safety chip only when a boxed warning exists, **maximum 192px**: raspberry word + reason (*QT prolongation — boxed warning*). At 1280 the line has 960px: 192 + 248 + 192 + 3 × 16 = 680, leaving 280px for the mechanism. The mechanism one-liner is the only element that may truncate, and only below its minimum.

Six rows = 624px; at 1440×1024 the list starts at y ≈ 400 (header 184, banner 32, gap 24, padding 48, heading and disclosure ~112), so five rows are visible and the sixth is one scroll away. Not on the row: any number that reads as a score, the case-for prose, the chain.

### 5.6 Ledger row and provenance block

Row: one line (§4.2). Expanded: a block in `.raw` (system mono, `--text-sm`), on `--color-surface-sunken`, 16px padding:

```
tool        clinicaltrials.gov/api/v2/studies
query       {"query.cond":"Parkinson's disease","query.intr":"nilotinib"}
retried     0 records → {"query.cond":"MONDO:0005180", ...}
run at      2026-09-19T14:02:11Z
records     2 trials on or before 2017-11-20
extracted   NCT02954978  NILO-PD  phase 2  n = 76  blinded         2016-11-04
            NCT0…        Georgetown pilot  open-label  n = 12       2014-…
verified    yes — human, 2026-09-19 (I. Ratushnyy)
```

(Illustrative; the pilot's registry identifier and registration date are filled by the curator — only NILO-PD's is asserted here.)

Seven fixed keys (`retried` only when a retry occurred). `tool`, `query`, `retried`, `run at`, `verified` are execution metadata and never change with the cutoff. `records` and `extracted` are derived from the row's dated `records` (§7.2) and show only those with `published ≤ cutoff`; the `records` line states the cutoff it was filtered to and **never shows a denominator or a total** at a historical cutoff. This block is the only place mono appears.

### 5.7 Evidence-as-of control

A solid segmented control, 40px tall, sharp corners, 1px line, positions from the candidate's `cutoffs` (nilotinib: *Jul 2016* · *Nov 2017* · *Today*). A candidate with only *Today* renders the control with a single segment that is visibly selected and not interactive, so the affordance sits in the same place on every Detail and a judge learns it once. Role `radiogroup`; arrow keys move; the active segment is `--color-surface-selected` with ink text. Changing it **replaces** the current history entry's `?asof=` (§3, history semantics) and re-renders sections 1–5 and the rail with a 240ms opacity crossfade; nothing slides. The frozen-date line under the bar comes from the cutoff's `note`.

### 5.8 Mechanism chain (ordered claims, vertical)

The chain is an **ordered list of claims**, each of which must hold for the hypothesis to hold. Evidence, labels and the weakest-link mark belong to claims. The arrows between claims mean *depends on* and carry nothing. (Codex S3: attaching evidence to an arrow such as *ABL1 inhibited → c-Abl active in PD brain* lets a relationship look established when only its endpoint is.) DOM, not canvas. A single column on the grid inside the sheet:

- **Endpoints:** the drug and the condition as sharp rectangles, 40px tall, 16px horizontal padding, 1px ink line, `--text-sm` (*nilotinib* at the top, *Parkinson's disease* at the bottom). No label, no evidence.
- **Claim row:** at least 48px tall. A vertical 1px marker line the row's full height, 16px in from the left edge, drawn with a border whose style repeats the label (solid for established and refuted, dashed for contested and single-source, dotted for unknown) in the label's color. To its right, first line: the claim in Regular (*nilotinib reaches the Parkinson's brain at a concentration that inhibits c-Abl*), then the label word in its color and Medium, then the qualifier when the label has one (single-source: *n = 12 · open-label · not replicated*; any label may carry a curated `scope` such as *in mouse models*). When the claim is the weakest, a second 24px line in raspberry `--text-sm`: *weakest link — one sentence why*. That row is then 72px.
- **Arrow:** between rows, a 1px ink line 24px tall, 16px in from the left edge, solid, ending in nothing — the vertical order is the arrow.
- Nilotinib: two endpoints and five claims: 2 × 40 + 5 × 48 + 6 × 24 + 24 (weakest) = 488px tall, any width above 480px. No horizontal scrolling ever.
- Claims outside the active filter draw their marker and text in `--evidence-dimmed` with the label word still legible. Each claim row is a `button` with `aria-pressed` when selected; the selected row's claim text is underlined.
- The filter pill floats over the block's top-right corner, 8px inset: one pill container, four pill buttons (*All* · *Contested* · *Single-source* · *Refuted*), 40px, role radiogroup. Glass per §9.

The export and print render the same chain as a numbered list (§5.11); a horizontal drawing is not produced anywhere in v1.

### 5.9 Driver bar

Four segments in a row, 248px total (56px columns — the narrowest that holds *mechanism* at 12px): for each, the segment word in `--text-xs` muted (*mechanism* · *clinical* · *exposure* · *safety*) above three 8px squares with 8px gaps. Filled square = `--color-ink`; empty = 1px `--color-line`. The clinical segment's squares are `--evidence-refuted` when `best_evidence.outcome` is `negative` from a controlled study. A `title` and `aria-label` spell it out: *mechanism 3 of 3, clinical 0 of 3 (controlled negative), exposure 1 of 3, safety 1 of 3.* Never a total.

### 5.10 Evidence label

The word, in its color, optionally with a qualifier. Colors: established ink · contested slate · single-source raspberry · unknown neutral-500 · refuted raspberry. Line styles: solid · dashed · dashed · dotted · solid. Never rendered without the word.

### 5.11 Export (one model, two outputs)

An `ExportDocument` is built from the same cutoff-filtered data the page shows, in this order: title (candidate · condition), **evidence date line** (the cutoff's note, or *as of <fixture date>*), Critical appraisal (visible objections with citations), Mechanism chain (numbered list: claim — label — why), Safety, Trial prerequisites (status each, and the unresolved count at this date), Your assessment (the choice and line stored for this cutoff, or *none recorded*), **Data note** (the banner sentence, including the replay disclosure), Sources (numbered ledger rows with tool and run timestamp, listing only records visible at the cutoff).

- *Copy as document* serializes it as Markdown to the clipboard; a 240ms confirmation replaces the button label with *Copied* and reverts.
- *Print* renders the same document into a print-only view (header, banner, rail, shard, and controls hidden; the Data note printed as a block under the title and again as the last section; citations as footnotes; 65ch measure) and calls `window.print()`. The disclosure is never dropped by either output (Codex R10).

## 6. Data source seam

```ts
interface DataSource {
  mode: 'fixture' | 'live'
  entities(): Promise<EntityIndex>                       // publishable entities only
  run(query: QuerySlug): AsyncIterable<LedgerEvent>      // ledger rows as they complete
  results(query: QuerySlug): Promise<ResultsPage>        // available once run() finishes
  candidate(query: QuerySlug, candidate: CandidateSlug): Promise<CandidateDetail>
  provenance(): Promise<Provenance>                      // banner and Methods
}
```

`FixtureSource` reads JSON bundled at build time, validates every candidate against §7.5 at build time (an unpublishable candidate fails the build with the missing fields named), and replays `run()` with scaled timing. A later `ApiSource` implements the same interface over HTTP/SSE. Screens receive data through the interface only; no component imports a fixture file.

## 7. Fixture contract

The types the backend must eventually fill. Dates are ISO `YYYY-MM-DD`. A `Timeline<T>` is a list of `{ from: date, value: T }`; resolving it at a cutoff picks the last entry with `from ≤ cutoff`, or `undefined` if none.

### 7.1 Entity index

```ts
type EntityIndex = { entities: Entity[] }
type Entity = { slug: string; name: string; kind: 'condition' | 'drug' | 'pair'; ids: Record<string,string>; aliases: string[] }
```

### 7.2 Ledger

```ts
type Ledger = { kind: 'recorded' | 'scripted'; recorded_total_ms?: number; rows: LedgerRow[] }
type LedgerEvent = { row: LedgerRow; done: boolean }
type LedgerRow = {
  id: string                 // "L1".."L10"
  step: string; source: string
  unit: string               // "targets", "trials", "records" — the noun for the derived count
  elapsed_ms?: number        // present only when kind = 'recorded'
  execution: { tool: string; query: string; run_at: string;
               retry?: { reason: string; query: string }        // the self-correction: what was retried and why; no count
               verified: { by: 'human' | 'automated'; date?: string; initials?: string } }
  records: { value: string; published: string; source?: SourceId }[]   // dated claims, filtered by cutoff
}
// There is no stored result count anywhere. "What came back" = records.filter(published ≤ cutoff).length + unit.
```

### 7.3 Candidate

```ts
type CandidateDetail = {
  slug: string; name: string; drug_class: string; approved_indication: string; condition: string
  cutoffs: Cutoff[]                          // at least { id: 'today', ... }
  sources: Source[]
  objections: Objection[]
  chain: { drug: string; condition: string; claims: Claim[] }   // ordered, drug side first; arrows are implicit
  safety?: Timeline<Safety>
  prerequisites: Prerequisite[]
  drivers: { mechanism: Pips; clinical: Pips; exposure: Pips; safety: Pips }   // Pips = 0|1|2|3, at Today
  best_evidence: Timeline<{ design: string; controlled: boolean; outcome: 'positive'|'negative'|'mixed'|'none'; n?: number; source: SourceId }>
  weakest_link: Timeline<{ claim: ClaimId; why: string; sources: SourceId[] }>   // curated, dated, sourced
  counts: { sources: number; trials: number }  // at Today; the row shows these
}
type Cutoff = { id: 'jul-2016' | 'nov-2017' | 'today' | string; label: string; date: string; note: string }
type Objection = { id: string; consequence_rank: number; claim: string; evidence: string; figure?: string;
                  published: string; sources: SourceId[]; cites: LedgerRowId[] }
type Source = { id: SourceId; first_author: string; journal: string; year: number; published: string;
                design: 'rct'|'open-label'|'pk'|'commentary'|'observational'|'preclinical'|'protocol'|'label'|'regulatory';
                controlled: boolean; blinded?: boolean; n?: number; outcome?: 'positive'|'negative'|'mixed'|'na';
                group: string; url: string; ledger: LedgerRowId }
type Claim = { id: ClaimId; short: string; text: string     // short: the row's noun phrase; text: the full claim
               scope?: string                                // e.g. "in mouse models" — shown after the label word
               evidence: ClaimEvidence[]
               override?: Timeline<{ label: Label; why: string }> }      // hand-curation, why is required
type ClaimEvidence = { source: SourceId; direction: 'supports' | 'contradicts' | 'refutes' }
  // 'refutes' is reserved for a source that directly tested THIS claim in a blinded, controlled study
  // and found it false. The validator (§7.5) rejects 'refutes' unless the source is
  // controlled: true, blinded: true, outcome: 'negative'. A measurement that argues against a claim
  // without testing it as a pre-specified endpoint (NILO-PD's CSF concentrations against "reaches the
  // brain") is 'contradicts', by curatorial decision, and that decision is visible on /methods.
type Prerequisite = { id: string; condition: string;
                      status: Timeline<{ resolution: 'met' | 'conditional' | 'unmet'; word: string; note: string; sources: SourceId[] }> }
type Label = 'established'|'contested'|'single-source'|'unknown'|'refuted'
```

**Label derivation** — `deriveLabel(claim, sources, cutoff)`, a pure function with unit tests, applied to the evidence whose source `published ≤ cutoff`. Evaluated in order; the first rule that matches wins and names the *why*:

1. **Override.** If `override` resolves at the cutoff, use it; its `why` is shown verbatim. (Hero-case hand-labeling per PRD §13; every override is listed on `/methods`.)
2. **Unknown.** No visible evidence.
3. **Refuted.** Any visible evidence with `direction: refutes`.
4. **Contested.** Visible evidence includes both `supports` and `contradicts`; **or** includes only `contradicts` (no supporting evidence at all). The generated *why* differs: *evidence on both sides* vs *no published evidence supports this claim; N source(s) argue against it*. A contradiction-only claim is contested rather than unknown because the hypothesis asserts the claim and the record argues against it. (Contradiction-only reaches *contested* only because rule 3 did not match first.)
5. **Established.** Only `supports`, from two or more distinct `group`s, or any supporting source with `design: regulatory` or `label`. A curated `scope` (*in mouse models*) is appended to the word when present.
6. **Single-source.** Only `supports`, from one group. Qualifier from that source: *n = 12 · open-label · not replicated* (blinding word from `blinded`, replication from the group count).

**Expected labels for nilotinib** — a required unit-test table. The labels below are the specification; the curator's job is to enter the named sources with the stated fields so the rules produce them. If a named source turns out not to say what is claimed here, that is a change to this spec (and to the PRD's story), not to the test.

| Claim | Jul 2016 | Nov 2017 | Today | Evidence that must be entered |
|---|---|---|---|---|
| C1 nilotinib inhibits ABL1 | established | established | established | Supports: FDA label for nilotinib (`label`, group *FDA*, ≤ 2007); Kantarjian et al. 2006 *NEJM* (`rct`, group *MD Anderson/Novartis*). Rule 5 via the regulatory source. |
| C2 c-Abl is activated in the Parkinson's brain | established | established | established | Supports: Ko et al. 2010 *PNAS* (`preclinical` with human postmortem tissue, group *Dawson, JHU*); Imam et al. 2011 *J Neurosci* (group *Imam*); Mahul-Mellier et al. 2014 *Hum Mol Genet* (group *Lashuel, EPFL*). Three groups, all ≤ Jul 2016 → rule 5. Scope: *in postmortem tissue*. |
| C3 c-Abl inhibition clears α-synuclein and protects dopamine neurons | established · in mouse models | established · in mouse models | established · in mouse models | Supports: Hebron, Lonskaya & Moussa 2013 *Hum Mol Genet* (`preclinical`, group *Moussa, Georgetown*); Karuppagounder et al. 2014 *Sci Rep* (`preclinical`, group *Dawson, JHU*). Two groups ≤ Jul 2016 → rule 5, with `scope: "in mouse models"`. No human evidence at any date; the *why* says so. |
| C4 nilotinib reaches the Parkinson's brain at a concentration that inhibits c-Abl | contested | contested | contested | Contradicts: Reinwald et al. 2014 *BioMed Res Int* (`pk`, CSF/plasma 0.53 %, group *Reinwald*). Supports: Pagan et al. 2016 *J Parkinsons Dis* (`open-label`, n = 12, CSF nilotinib detected, group *Moussa, Georgetown*). Today adds contradicts: NILO-PD PK abstract 2020 *Neurology* (`pk`, group *Simuni/NILO-PD*) — entered as `contradicts`, **not** `refutes`, because exposure was not a pre-specified efficacy endpoint tested to a conclusion (curatorial decision, stated on `/methods`). Rule 4 at every date. `weakest_link` at every cutoff, with why: *the mechanism cannot act on a brain the drug does not reach at an inhibiting concentration.* |
| C5 nilotinib improves Parkinson's clinical outcomes | single-source | contested | refuted | Jul 2016: supports Pagan 2016 only → rule 6, qualifier *n = 12 · open-label · not replicated*. Nov 2017: adds contradicts Schwarzschild 2017 *J Parkinsons Dis* (`commentary`, published 2016-12, group *Schwarzschild, MGH*) → rule 4. Today: adds refutes Simuni et al. 2021 *JAMA Neurol* (`rct`, controlled, blinded, n = 76, outcome negative, published 2020-12) → rule 3. |

The PRD's fixed facts these encode: *"At Jul 2016 … the clinical link is single-source"*, *"At Today, the clinical link reads refuted"*, *"The CNS-exposure link is contested and is visibly the weakest."* The unit test asserts all fifteen cells and the two contradiction-only cases (a `refutes` entry → refuted; `contradicts` only → contested).

**Prerequisite resolution and ordering** — a prerequisite is *unresolved* at a cutoff when its resolved status has `resolution: unmet`; `conditional` (e.g. *with monitoring*) counts as resolved and shows its word. Results order by the unresolved count **at Today**, ascending; ties by `counts.sources` descending, then name. The Results header states the rule and the date. Detail's heading shows the count at the selected cutoff (§4.3).

**Cutoff filtering, everywhere** — objections, claim evidence, safety, prerequisite status, best evidence, weakest link, ledger records, and the export are all resolved at the selected cutoff. `drivers` and `counts` are *Today* values and appear only on Results (which is always *Today*).

### 7.4 Fixture coverage required for v1

| Query | Candidates | Detail depth |
|---|---|---|
| `parkinsons-disease` | ambroxol, exenatide, isradipine, nilotinib, simvastatin, metformin | nilotinib: full, three cutoffs. Others: publishable (§7.5) at *Today*. |
| `metformin` | Parkinson's disease + at least two other conditions | *Today* only; the PD row carries the 2025 pilot. |
| `nilotinib--parkinsons-disease` | nilotinib | same record as above |

Curating the non-hero candidates is content work outside this spec. The frontend shows only candidates that pass §7.5; the Parkinson's list is as long as the number of publishable candidates on the day.

### 7.5 Publishability

A candidate is publishable when **at every cutoff it offers** (not only *Today*): ≥ 1 objection visible at *Today* (historical cutoffs may have none, and then render the §8 empty line); a chain with ≥ 1 claim, every claim labelable at that cutoff (rules 2–6 or an override with a *why*); all five prerequisites resolve to a status at that cutoff; `best_evidence` resolves; `weakest_link` resolves to an existing claim with a `why`; `safety`, if present, resolves or is absent by design. At *Today* additionally: `drivers` and `counts` present; `best_evidence.outcome: none` implies `controlled: false`. Every `SourceId` referenced exists and has `published`, `group`, `url`, `ledger`; every `direction: refutes` entry points at a source that is `controlled: true`, `blinded: true`, `outcome: negative`. The build validates this and fails naming the candidate, the cutoff, and the missing field. Unpublishable candidates never appear in the entity index, Results, the scatter, or by URL. A required negative fixture: a record valid at *Today* whose prerequisite timelines start after *Jul 2016* must fail validation.

## 8. States and errors

- **Unresolvable query text:** the inline note under the field (§4.1); no navigation.
- **Unknown or unpublishable slug in the URL:** the sheet shows *No curated appraisal at this address* with the three covered queries as links. Same for an unknown candidate.
- **Fixture load failure:** the banner turns to the sentence *Fixture data failed to load — reload the page* (still no raspberry); the sheet is empty. This is the only failure state in fixture mode.
- **Ledger replay interrupted by navigation:** the replay continues in memory so returning shows the completed ledger.
- **`localStorage` unavailable:** the assessment still works for the session; nothing is thrown.
- **No safety argument at the cutoff:** section 3 is absent, not empty.
- **Empty section in a record:** cannot occur for a publishable candidate; if a section has no items visible at a historical cutoff (all objections later than the cutoff), the section renders its heading and one annotation line: *Nothing published on or before this date.*

## 9. Glass

Two glass surfaces in the whole app: the entry chips (§4.1) and the chain filter (§5.8). Both are pill containers holding pill buttons: the shapes the vendored library provides. Build order per decision 15:

1. Ship with the `.glass-fallback` class always on: solid white at `tintOpacity` ≥ 0.3 equivalent, 1px line, `backdrop-filter: blur(6px)`. Same markup and size as the WebGL version.
2. After Detail passes the §3 test, enable liquid-glass-js behind the detection in `design/glass/README.md`. Snapshot once on mount; re-capture (debounced 300ms) only when the chain filter changes what is behind the pill. No canvas anywhere, so no `preserveDrawingBuffer` concern.
3. At most two glass containers on screen; never nested.

## 10. Motion and accessibility

- Transform and opacity only, `--duration-base` 240ms and `--ease-out`; ledger rows rise 8px and fade in; as-of changes crossfade; a ledger row or the ledger disclosure expanding is a height change on the grid. `prefers-reduced-motion` collapses all durations via the existing tokens.
- Every label is a word; every control has a visible focus ring in `--color-focus`; the as-of control and the chain filter are radiogroups; chain claims are buttons; the results row's name is the link. Contrast per `design/palette.md`; the driver bar and status squares carry `aria-label` text.
- Minimum supported width 1280px (decision 12); below it the page scrolls horizontally rather than reflowing. Supported heights: the fold measurements in §4.3 and §5.5 are checked at 1440×1024 (projector) and 1440×900 (laptop) before the §3 test.

## 11. Design-system changes this spec requires

Applied to `DESIGN.md`, `.impeccable.md`, `design/palette.md`, `design/tokens/*.css`, `design/glass/README.md` once this spec is approved:

1. **Six moments table** rewritten to the PRD: Entry (one field, three chips, worked appraisal), Working (evidence ledger, accelerated replay labeled), Results (three-line rows ordered by unresolved prerequisites; driver bar; scatter), Detail (*Critical appraisal*; vertical chain with five labels; safety as a reason; trial prerequisites; your assessment; *Evidence as of*), Provenance (replaces *Depth*: ledger rows and `/methods`), Exit (copy as document, print; one export model with the disclosure).
2. **Confidence rule** changes from *a figure that opens its drivers, never a bar* to *a driver bar of four named segments with monochrome pips; never a number*. Palette.md's last line follows.
3. **Refuted** added to the evidence labels in DESIGN.md and palette.md; `--evidence-refuted: var(--raspberry)` added to `colors.css`; line style solid.
4. **The sheet** added under Layout: one rounded solid sheet per page is the exception to sharp corners; `--radius-sheet: 32px` and `--shadow-sheet` added to `space.css`. Cards inside remain forbidden.
5. **Header** sizes: `--header-height` becomes 184px for inner pages and `--band-entry: 280px` is added; the wordmark sizes (96 / 64) noted under Typography.
6. **Chain model and direction**: an ordered list of claims, each carrying its own label, evidence and (optionally) scope; arrows mean *depends on* and carry nothing; *reads top to bottom, drug to condition*; each claim is a full-width row whose marker line repeats the label style; the weakest link is a full line.
7. **Glass** section: entry glass is the three example chips (not two choices); chain controls are one filter pill (no fit/zoom); budget two containers. `glass/README.md` example updated to match.
8. **Depth → Provenance**; `.raw` comment in `typography.css` now names the provenance block; the *Show the agent's work* toggle is removed from all docs.
9. **Narrow screens** paragraph replaced with the 1280px minimum for v1.
10. **Not this** gains: *a tab or button that leads nowhere; a count of what a historical view hides.*

## 12. Build order

Detail first; each step leaves a runnable app.

1. Scaffold Vite + React + TS; import `design/tokens/index.css` and `fonts.css`; header, banner, sheet, rail, routes with placeholder text only in the sheet (never a placeholder control).
2. Fixture types (§7), `deriveLabel`, `Timeline` resolution, prerequisite resolution, ordering, publishability validation — with unit tests (Vitest), including the nilotinib expected-label table. Nilotinib record curated in parallel from the PRD's dated sources.
3. Detail: candidate bar + as-of control → Critical appraisal → vertical chain of claims + rail claim evidence → safety → prerequisites → assessment + export model + copy + print view. Run the §3 test here.
4. Results: rows, ordering line, driver bar, ledger disclosure; scatter tab.
5. Entry: band, field with typeahead, shard, chips (fallback glass), worked appraisal.
6. Working: ledger replay with the accelerated-replay banner, collapse into the disclosure, citation → rail on Detail.
7. `/methods`; static deploy; deep-link smoke run of the demo script.
8. WebGL glass enhancement; projector pass on the sheet shadow, shard offsets, and the fold measurements.

## 13. Testing

- **Unit (must):** `deriveLabel` for every rule, and the nilotinib expected-label table — all fifteen cells at the three cutoffs; `refutes` → refuted and `contradicts`-only → contested; timeline resolution; prerequisite resolution and results ordering (conditional counts as resolved); publishability validation rejects a record missing each required field and rejects the §7.5 negative fixture (valid at *Today*, undefined at *Jul 2016*) and a `refutes` entry on an uncontrolled source; the ledger's derived count for the retry row at each cutoff; scatter mapping covers every `controlled × outcome` pair; export Markdown snapshot for nilotinib at *Nov 2017* containing the evidence date line, the data note, and no record later than the cutoff.
- **Component (should):** as-of switch to *Jul 2016* hides the MAO-B objection and shows no count; switching cutoff while a later citation is open returns the rail to the ledger; opening the retry ledger row at *Nov 2017* shows the historical count only; Results → Detail → *Nov 2017* → *Jul 2016* → Back lands on Results (one entry); every results row navigates; the chain filter dims the right claims; a *Today*-only candidate shows the single-segment control.
- **Human (must, PRD §3):** three people, nilotinib Detail, two minutes, verbatim answers, result in the README pass or fail.
- **Smoke (should):** a Playwright run of §3's demo routes against the static build at 1440×1024 and 1280×800, asserting no horizontal page scroll and the first objection above the fold.

## 14. Assumptions and open items

- The five non-hero Parkinson's candidates and the metformin conditions are curated as content by the team; until each passes §7.5 it is absent, and the Parkinson's list is shorter than six. The demo script's "ambroxol first, nilotinib fourth" depends on all six being publishable.
- `Today` in the fixture is the fixture's generation date, shown as such.
- Whether the ledger will be `recorded` (a real run captured by the backend track) or `scripted` is the backend team's call; the UI supports both and labels each honestly.
- The rubric caps the main deck at 10 slides; the PRD says 10–12. The PRD should be corrected; not a frontend concern.
- The shard SVG from the mockup will be committed under `design/shard/shard.svg` as the brand asset; the Figma export is the source.

## 15. Review reconciliation

A Codex adversarial review (`codex-cli 0.155.1`, Sept 19) was run against draft v1 of this spec with the PRD, DESIGN.md and the rubric as references. Its findings and what changed:

| # | Codex finding | Severity | Disposition |
|---|---|---|---|
| R1 | Label rules could not reproduce the backtest: `Source` had no outcome, `direct_test` had no polarity, contradiction-only fell into single-source | high | **Accepted.** §7.3 adds `outcome`, `controlled`, `blinded` on sources, `direction` + `direct_test` on evidence, defines contradiction-only as contested with a distinct *why*, and requires the nilotinib expected-label table as a unit test. |
| R2 | Historical views did not constrain the rail or export; a Nov 2017 page could expose NILO-PD through a citation | high | **Accepted.** Cutoff filtering is now defined for every evidence-bearing surface (§4.3, §5.4, §5.6, §5.11, §7.3); ledger `execution` metadata is separated from dated `records`; a cutoff change re-resolves an open rail item. |
| R3 | The two-line Results row reserved 560px of fixed columns and could not fit at 1024, or beside a rail at 1440 | high | **Accepted, with a further change.** Results loses the rail (ledger becomes a disclosure line); rows become three lines with the weakest link on its own line; minimum width raised to 1280; widths tabulated in §5.3. The same math showed a six-node horizontal chain cannot fit beside the Detail rail, so the chain is vertical (§5.8, decision 8). |
| R4 | "Minimal record" fallback let an uncurated candidate open a Detail without an appraisal | high | **Accepted.** §7.5 publishability gate; build fails on an unpublishable candidate; the Parkinson's list is as long as the publishable set. |
| R5 | The hidden-objection count leaks that later adverse evidence exists | medium | **Accepted.** No count, no placeholder; the frozen-date line is the only feedback (§4.3). Added to *Not this*. |
| R6 | Prerequisite satisfaction was an unrestricted string; Detail's historical count was conflated with the Today count that orders Results | medium | **Accepted.** `resolution: met / conditional / unmet`; unresolved = unmet; conditional counts as resolved; Results uses Today and says so; Detail says *at this date* (§4.3, §7.3). |
| R7 | Scatter quadrant captions could not distinguish "failed in people" from "untested" at y = 0 | medium | **Accepted.** y is a four-level ordinal (*controlled negative · no human test · uncontrolled positive · controlled positive*) with a legend and no quadrant captions; identical points offset 16px and stay individually focusable (§4.2). |
| R8 | Twelve-second playback was not disclosed as accelerated; "recorded run" could be a scripted sequence | medium | **Accepted.** `Ledger.kind` recorded/scripted; the banner says *accelerated replay of a recorded run (74 s shown in 12 s)* or *scripted sequence, not a live run*; recorded elapsed figures shown, scripted shows none (§4.2, §5.2, §7.2). |
| R9 | An assessment entered against Today could be exported under a historical date | medium | **Accepted.** Storage key includes the cutoff; one assessment per cutoff; the export states the cutoff and uses that cutoff's assessment (§4.3, §5.11). |
| R10 | The print stylesheet hid the banner, dropping the disclosure | medium | **Accepted.** One export model for clipboard and print; the Data note prints under the title and as the last section (§5.11). |
| — | Codex's closing note: keep weakest-link selection curated with a dated, sourced rationale | — | **Accepted.** `weakest_link` is a `Timeline<{ claim, why, sources }>` (§7.3) and the reason is shown on the chain row and in the rail. |

### Second pass (draft v2 → v3)

Codex re-reviewed v2 and confirmed R5, R8, R9, R10 closed and the §5.3 width table correct. Remaining findings and what changed:

| # | Codex finding | Severity | Disposition |
|---|---|---|---|
| S1 | R1 still open: NILO-PD's CSF measurement, entered once with the metadata the clinical claim needs, would fire the refuted rule on the exposure claim | high | **Accepted.** `direction` gains a third value `refutes`, reserved for a blinded controlled direct test of *this* claim and validated against the source's fields; a measurement that argues against a claim without testing it is `contradicts` by a curatorial decision stated on `/methods` (§7.3). Rule 3 keys on `refutes` only. |
| S2 | R2 still open: `retry.result` was an undated count; the §5.6 example printed a historical denominator | high | **Accepted.** `retry` is execution metadata with no count; every displayed count is derived from visible records with the row's `unit`; the example and §5.6 forbid denominators at historical cutoffs; tests added (§4.2, §5.6, §7.2, §13). |
| S3 | The chain attached evidence to arrows that the evidence does not establish (*ABL1 inhibited → c-Abl active in PD brain*) | high | **Accepted, structural change.** The chain is an ordered list of **claims**, each with its own evidence and label; arrows mean *depends on* and carry nothing. `chain.claims` replaces `nodes/links` (§5.8, §7.3, decision 8). DESIGN.md's "links carry the label" becomes "claims carry the label; the marker line repeats it." |
| S4 | R4/R6: publishability checked only *Today*; timelines could be undefined at an offered historical cutoff | high | **Accepted.** Validation runs at every offered cutoff; a negative fixture is required (§7.5, §13). |
| S5 | Six expected-label cells said "curated" | medium | **Accepted.** All fifteen cells specified with the named sources and groups that must be entered; a source that fails to say what is claimed is a spec change, not a test change (§7.3). |
| S6 | Results line 3 had two width interpretations | medium | **Accepted.** Line 3 spans everything after the rank column; gaps 16px; mechanism minimum 256px; safety chip maximum 224px; 288px left for the mechanism at 1280 (§5.5). |
| S7 | `?asof` push/replace undefined; return-to-Results context undefined | medium | **Accepted.** `asof` replaces history; rows open at *Today*; back link reads *← Results · as of today*; Results states the fixture date; a navigation test is required (§3, §4.2, §4.3, §5.7, §13). |
| S8 | Scatter lacked a coordinate for uncontrolled negative and silently relabeled controlled mixed | medium | **Accepted.** Exhaustive five-level mapping of `controlled × outcome` with truthful level names (§4.2). |
| — | Vertical chain: keeps walkable evidence; orientation is not a blocker; verify with the populated layout in the two-minute test | — | Noted; the §3 test is run on the populated Detail (§12 step 3). |
| — | Single-segment as-of control: consistent; implement as non-interactive status | — | Already specified so (§5.7). |

Where this spec and the review still differ: none outstanding. Two points go to the product owner because they change stated design: the vertical chain, and the chain-of-claims model (which the PRD's "each link one claim" supports but DESIGN.md's node-and-link drawing does not).


## 16. Flow revision (v4) — the user-flow mockups

After v3 was approved and built, the product owner supplied seven user-flow mockups (Appraise, Working, Results list, Results board, Detail, Sources, Export) and asked for the flow to follow them, the data banner to go, Aujournuit titles to be lowercase, one tighter header, and subtle, consistent motion. The mockups define **structure and flow**; the design system defines **material** (type, palette, grid, sharp corners, label squares instead of the mockups' green/amber dots). This section records what changed against §§2–5. Where §16 and an earlier section differ, §16 wins.

### 16.1 Decisions changed

| # | Was (v3) | Now (v4) | Why |
|---|---|---|---|
| 2 | Rail on Detail | **No rail.** Detail is one column; a selected chain link opens a claim/evidence panel below the chain; citations go to the Sources page | The mockup's Detail is a single reading column; the width problem that forced the vertical chain disappears |
| 3 | One rounded 32px sheet per page | **White panels with one 1px line on the sunken page; nothing rounded** | The mockups are panels on an off-white page; DESIGN.md's sharp-corner rule holds without an exception |
| 4 | Sentence + field in a white band, glass chips over the shard hero, worked appraisal below | **Appraise page:** kicker, 64px field with the *Appraise* button inside, three outlined mode chips, *paste a paper*, a *recent* list. No shard hero; the shard is the header band on every page | Mockup 1 |
| 5 | Driver bar on the results row | **Driver bar on the Detail title block (Today only)**; rows carry chip, weakest link, safety, unresolved count | Mockup 3's row has no bar; the bar shows what set the rank where there is room |
| 8 | Vertical chain of claims | **Horizontal chain of claims**: nodes as boxes, each claim drawn as the link between two nodes with its label square, word, caption, and a *weakest link* badge; no filter pill | Mockup 5; with no rail the six-node chain fits the column at 1280 |
| 9 | Ledger collapses to a disclosure line above the results | **Working page** with the ledger in a panel (✓ / ! / ● glyphs, running row with a 2px bar, pending rows faint), a side panel showing a finished step's records, and a status line; after completion the results replace it and the ledger lives on the **Sources** page | Mockup 2 |
| 10 | `/methods` | **`/q/:query/sources`** with tabs *Ledger · Tool calls · Packages · Status rules*; records numbered 1.1, 2.2 …; `/methods` redirects | Mockup 6 |
| 11 | Copy as document + Print from Detail | **`/q/:query/:candidate/export`**: format (Markdown, JSON, print), include checkboxes, live preview; download, copy, copy link. Detail's *Export appraisal* button leads there | Mockup 7 |
| 12 | Scatter view; paste-a-paper cut | **Board view** (columns by trial stage) replaces the scatter; **paste-a-paper is in** as an inline panel with a static extraction preview for three fixture papers and an honest no-match state | Mockup 4 shows a board; mockup 1 shows the paste link, and a visible link must work |
| 15 | CSS glass now, WebGL later | **No glass loaded.** No control floats over something being read in this flow; the layer stays vendored | Nothing to justify it |
| 16 | 32px banner under the header | **12px italic data note at the foot of every page**; the Working status line and the Sources sub line also say *scripted sequence, not a live run* | Product owner's call; the PRD's every-screen rule is kept |
| — | 184px header; wordmark 96/64 | **120px header on every page**: wordmark 48px, the compact field (not on Appraise), the shard band | Product owner's call |
| — | — | **Aujournuit is always lowercase** (`text-transform` in the tokens); Supreme keeps casing | Product owner's call |

### 16.2 Results grouping

Rows are grouped *not yet refuted* / *refuted in controlled studies* (best evidence controlled and negative), ordered within each group by the §7.3 rule. This makes the PRD's narrative order fall out of the data — the refuted candidates sit below the open ones — without changing the tie-break. The unresolved count is shown only for candidates not yet refuted; refuted rows show a dash.

### 16.3 Data model additions

`Claim.node` (the node a claim arrives at) and `Claim.short` (the link caption); `BestEvidence.stage` (`preclinical · open-label · phase-2 · phase-3-enrolling · phase-3`, the board column) and `BestEvidence.label` (the trial name line); `src/fixtures/papers.ts` for paste-a-paper. Cutoff filtering, label rules, publishability and the expected-label table are unchanged and still pass.

### 16.4 Motion

One reveal per page: blocks rise 8px and fade in with a 40ms stagger (`.rise`, `--i`). Ledger rows rise as they complete; the running row's bar fills over the step's playback duration. Objection rows and disclosures open on `grid-template-rows`. A cutoff change re-mounts the Detail body as one reveal; the rail crossfade is gone with the rail. Hover lifts 1px, press scales 0.98, colour settles over 240ms. Reduced motion collapses every duration through the tokens.

### 16.5 Still open

- The §3 two-minute test has not been run; the README says so.
- Draft candidates are marked *draft* on the row, the Detail meta line, and the Sources rules tab; their sources need verification.
- The ledger is scripted; a recorded run would light up the elapsed column and the *accelerated replay* wording automatically (`Ledger.kind`).
