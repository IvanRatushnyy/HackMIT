# Redesign the elute front end. Keep every fact.

You are the lead product designer and front-end engineer on elute, a drug-repurposing appraisal tool built for one person: a translational scientist in pharma who is accountable for being wrong and distrusts AI by default. You are redesigning the whole interface. Nothing the interface currently says may be lost, and nothing may be added that the record does not contain.

Read before you touch anything, in this order: `PRD Elute.md` §3, §6, §7 (the six moments, the results card, the pathway drawing); `DESIGN.md`; `design/palette.md`; `user_journey.txt`; `src/data/types.ts`; `src/fixtures/nilotinib.ts`; every file in `src/screens` and `src/components`; `src/styles/base.css` and `src/styles/screens.css`. Then run `npm run dev` and walk the demo route below at 1440 px before you form an opinion.

The demo, which is what you are designing for: a projector in a lit room, 1440 px wide, a judge who is the user.

1. `/` type **Parkinson's disease**, Enter.
2. `/q/parkinsons-disease` the ledger builds; results appear.
3. Open **nilotinib** → `/q/parkinsons-disease/nilotinib`. This page is the product. The judge must be able to say, unprompted and within two minutes, what the strongest argument against nilotinib is and which link in its mechanism is weakest.
4. `?asof=nov-2017` the same page frozen the day NILO-PD enrolled its first patient: three objections on screen, none of the post-trial ones.
5. `/q/parkinsons-disease/nilotinib/export`, then `/q/parkinsons-disease/sources`.

## 1. What does not change

**The data and the rules.** Do not edit `src/data/`, `src/fixtures/`, or `src/lib/`. `npm test` must pass unchanged. Every screen reads through `source` in `src/data/source.ts`; every label, order, count and date comes from `src/lib/evidence.ts`. If the design needs a value the record lacks, the design changes, not the record.

**The routes.** `/`, `/q/:query`, `/q/:query/:candidate`, `/q/:query/:candidate/export`, `/q/:query/sources`, `/methods`, and the `?asof=`, `?view=board`, `?paste=1&text=` and `#L7` deep links. The demo is scripted against them.

**The persisted state.** The scientist's call and reasoning are saved under `assessmentKey(query, candidate, cutoff)` in localStorage and travel into the export; recent queries are recorded by `touchRecent`. Keep both.

**The principles**, from `user_journey.txt` and `DESIGN.md`. The counter-case is the headline. Every claim carries its label as a square and a word, never colour alone, never a bare number. Safety is a reason, not a banner. Sources are one click away and land on the Sources page. The tool never recommends and never explains itself. Nothing is set in all caps except names already written that way (MONDO, NCT, NILO-PD).

## 2. What changes

Everything the eye lands on: `src/screens/*`, `src/components/*`, `src/styles/*`, `design/tokens/*`, `design/fonts/fonts.css`, `index.html`. Restructure components freely. Add dependencies for motion or layout if you need them; record each in `package.json`, which the Sources page's Packages tab reads. Replace the current glass-panel system entirely. The `Pathway` component's cytoscape drawing may be restyled or redrawn in SVG; its data contract (`PathwayDrawing`, `validateDrawing`) stays.

Delete the old stylesheets rather than layering on them. A redesign that inherits `.panel`, `.arrive`, `.chain` and `.results__row` is a reskin.

## 3. The design brief

**Character.** A peer review that is also a beautiful object. Quiet where the scientist reads; alive where the tool works. Confidence from showing its work. Doubt drawn as rigour: the objection to a drug is the most finished element on the page, never a warning box.

**Type.** The two brand faces are in `design/fonts` and stay unless you can show a better pairing side by side. Use them harder than the current build does:

- Aujournuit has one weight and a width axis from 50 to 200. That axis is your signature motion: the wordmark and every page title arrive by settling along the width axis, wide to regular, the letters tracking in as the width closes. Nothing else in the product animates its type.
- Supreme has a weight axis from 100 to 800 and a true italic. Body at 400, interactive labels at 500, and hover carries weight from 400 to 500 through the axis, not through a font swap. The one figure that carries an argument, `n = 12`, `0.53 %`, sits at 700 and nowhere else.
- Enable `frac` and `sups` where a figure is written. Neither face has tabular figures; right-align every column of numbers.
- Choose a type scale with one line-height rhythm and defend it in the design note. The current 8 px grid is a good rhythm; keep it or replace it with one you state.

**Colour.** The four brand colours (ink `#06070e`, slate `#47667d`, dust `#d3d3d3`, raspberry `#82204a`) are the family. Deepen them into a palette that is memorable on a projector: a true ink ground for the moments the tool is working (startup, the ledger), a warm paper ground for the moments the scientist reads (results, detail, export), and each of slate and raspberry in three steps (deep, mid, tint) defined in OKLCH so the steps are perceptually even. Raspberry stays rare by rule: the single-source and refuted labels, the safety flag, the negative outcome, the weakest link. If more than a few pixels of raspberry are on screen, the candidate is genuinely weak and the page should look it. Contrast against every ground at 4.5:1 for text and 3:1 for lines; print the ratios in the tokens file as the current one does. Gradients are allowed only as the material of a background, never on text or a control.

**Surfaces.** Decide one material system and state it. Worth trying: paper sheets with a real drop shadow on the ink ground; frosted glass over a moving shard; flat paper with rules only. Pick by building the nilotinib Detail page in two of them at low fidelity and screenshotting both. Controls are always solid and sharp; the shard's geometry is the reference.

**Motion.** Vivid where the tool is doing something, still where the scientist is reading.

- Startup: the shard composes plane by plane into the hero, the wordmark settles along its width axis, the planes come apart into bands (a mixture eluting), and the page develops beneath. Keep the idea, rebuild the execution.
- The Entry background ripples. Build a slow, continuous displacement of the shard composition behind the ask box (SVG `feTurbulence` with `feDisplacementMap`, or a small WebGL shader; `design/glass/vendor` holds a refraction library you may use or discard). Submitting the field sends one ripple outward from the box across the whole page, and the ledger page arrives on its wake. Reduced motion collapses every duration through the tokens; the ripple becomes a fade.
- Working: each ledger step arrives in three beats 240 ms apart, ease-out: the question in six words or fewer (`Which targets have genetic evidence?`), the source as a chip (`Open Targets Platform`), what came back as a count and one concrete item (`8 targets · SNCA`). Evidence chips are the row's real `records`, each with its date. A strip of ten marks the position. Only the current step moves; finished steps settle with a check; queued steps sit faint. No spinner, no bar, no percentage.
- Reading surfaces: a block arrives once (opacity, transform, blur, 400 to 640 ms, ease-out, staggered 40 ms) and then holds still. A row expanding is a height change, never a slide. Hover settles over 240 ms; press scales to 0.98. Nothing on Detail loops.
- Changing the evidence date re-mounts the body as one reveal, and the objections that vanish at an earlier date visibly leave.

**The shard.** `design/shard/shard.svg`, thirteen planes in the four colours, parsed by `parseShard` and drawn plane by plane by `Shard` in `src/components/frame.tsx`. It is the mark, the header band and the animated background. It is never placed behind body text.

## 4. Progressive disclosure

Every screen has a ladder. Rung 0 is what a fifteen-second glance gets; each rung down adds one kind of thing and never repeats what the rung above promised. Nothing may be discoverable only by hovering; every rung is reachable by keyboard and by touch. State the ladder for each screen in the design note before building it.

**Entry.** Rung 0: one field, three example chips that teach the three modes (`Parkinson's disease`, `metformin`, `nilotinib for Parkinson's`), nothing else. Rung 1: the `+` opens paste-a-paper; the extraction (title, citation, design, blinded, placebo arm, n, outcome, would classify at) shows before anything runs, with `Appraise …` and the line that says to stop if the read is wrong. An unmatched query gets the note in `useAsk`, never a navigation. Recent appraisals may return as a quiet rung 1 under the box.

**Working → Results.** Rung 0 while working: the ledger and the status line (`step 6 of 10 · 0:31 · scripted, about 12 s · results open when done`). Rung 1: a finished step opens to its records beside it, dated, with `ledgerResult` and the source. Rung 0 at results: two registers named **Tested in placebo-controlled trials** and **Not yet tested against placebo**, each with its rule printed once in one line beneath the heading, ordered by `orderCandidates`. On each row, under 25 words: drug class in display type leading, the name at body size directly beneath in the same place on every row, one muted line of fine print (modality · compartment · route, from `delivery`), and four answer cells: outcome tag with design and n, weakest link in one line, safety word, unresolved count. Rung 1: the row expands in place into a four-step walk (Does it work in people? Could it work? What could go wrong? What would it take?), stepped by arrow keys or click, each step showing its evidence lines with for and against distinguished. The board by trial stage stays as `?view=board`. Draft records say `draft` on the row.

**Detail.** This inventory is the contract. Every item below is on the current page and must be on yours, at the rung stated. `*` marks what must be visible without any interaction.

- Title block: `*` name and condition; `*` drug class; approved indication; the mechanism one-liner (`ABL1 → α-synuclein clearance`); `draft record, sources not yet verified` when `curation === 'draft'`; the way back to the results (`← all candidates for …` for a pair query, `← results · as of today` otherwise).
- `*` Best evidence: `OutcomeChip` with `bestEvidenceText` and `label` (`NILO-PD 2021`), and `DriverBar` today only. Keep the four named driver segments with pips; never a number.
- Evidence as of: the three cutoffs (`Jul 2016`, `Nov 2017`, `Today`) with each cutoff's note (`Evidence frozen at 20 Nov 2017 — the day NILO-PD enrolled its first patient.`). The PRD calls this demo mode; place it where a presenter reaches it in one motion and a scientist is not distracted by it.
- `*` Critical appraisal, first, above the fold: every objection from `visibleObjections`, numbered by consequence, `*` claim visible. Rung 1 per objection: the evidence sentence with its figure bolded, the sources as author, journal, year linking out, the published date, the ledger citations `[L7]` linking to `/q/…/sources#L7`. The empty state at an early date: `Nothing published on or before this date.`
- The pathway: the drawing (compartments as bands, molecules as glyphs by kind, actions with heads by kind, stroke by label, background biology in grey, the weakest link marked, the refuted arc carrying its word); the status (`live` with timestamp, `offline`, `none`); rung 1 on selecting an action: the claim panel below (claim sentence, label with qualifier, why, for and against with `SourceLine`); the Reactome plate for a pathway the target is filed under, demoted to a thumbnail that expands; the fine print (target compartment, tractability by modality, route, barrier, what else the target is filed under, `not curated` on every edge past the first). `validateDrawing` must still pass for nilotinib.
- Mechanism as a chain: drug node, then for each claim its label square and word, `scope` after the word (`in mouse models`), `short` as the caption, `weakest link` on one; rung 1 on select: claim text, label with qualifier, `why`, weakest-link `why`, evidence for and against. You may merge the chain into the pathway if the same information survives at the same rung; state the decision.
- Safety and Before a trial: `*` the safety flag and kind (`QT prolongation — boxed warning`) and `*` the count (`4 of 5 unresolved`, `at this date` when frozen). Safety rung 1: the reason, the population paragraph, the sources; the two other states (`not yet on the label` with its sentence, `not assessed` with its sentence) verbatim. Before a trial as five numbered boxes in a row, each with its condition and status word, `unmet` set apart from `met` and `conditional`; rung 1 on select: `note` and the ledger reference; arrow keys step 1 to 5. A stepper, not a carousel: the five are sequential and the scientist must always see where they are.
- Your call: three choices (`pursue`, `needs specific data`, `deprioritise`), the reasoning field (`In your words.`), `Export appraisal`. Persisted per cutoff.
- Missing record: `no curated appraisal at this address` with the three covered links.

**Sources.** Rung 0: the run (timestamp, heading, steps, records, `scripted sequence, not a live run`), the ledger with every record numbered `1.1, 2.2 …` and `open` on records with a source. Rung 1: a row expands to its `ProvenanceBlock` (tool, query, retried, run at, records, extracted, verified). Secondary: Tool calls, Packages (from `package.json`), Status rules (the six rules in order, overrides, curatorial decisions, curated, synthetic or draft, production sources, what this is not). A frozen visit (`?asof=&c=`) shows the cutoff note and `Records after this date are not shown.` with the way back.

**Export.** Format (Markdown, JSON, PDF via print), the six include toggles, the live preview built by `buildExport` (title, meta, your call, sections, the foot with source count and data note), Download, Copy, Copy link. The include list and the preview may become one surface.

## 5. Formats to try

Run each experiment, screenshot it, keep what survives the rule at the end.

- **Popover** (native `popover` attribute with CSS anchor positioning; fall back to a positioned portal): a citation opens a source card in place: first author, journal, year, design and n, direction for or against, the ledger line, `open`. Try it on objections, the claim panel and the sources ledger. Escape closes; focus returns.
- **Sheet** (a `dialog` element): Export as a sheet over Detail, so the scientist never leaves the page; paste-a-paper as a sheet over Entry. Keep the routes working by opening the sheet on navigation.
- **Carousel**: only for parallel items of one kind where seeing one at a time loses nothing. Candidates: the pathways the target is filed under (ABL1 has thirteen in Reactome); the sources behind one claim; the three evidence dates as a scrubber. Never for objections, prerequisites, ledger steps or results rows: those are ranked or sequential, and a carousel hides the count and the position. A carousel shows its count and its position and supports arrow keys, swipe and the wheel.
- **Stepper**: the results row's four questions and the five prerequisites. Position always visible, arrow keys, the current step named.
- **Expand in place**: objections, ledger rows, results rows. Height change on a grid, never a slide.
- **Scrubber**: the three cutoffs as a timeline the presenter drags, with the objections entering and leaving as the date crosses their `published` dates. If it is good, it is the closing beat of the demo.

The rule for keeping a format: it must reduce what is on screen at rung 0 without hiding anything the rung above promised, and it must work with a keyboard alone.

## 6. Words

The interface has no voice. Every string is a name, a value, a label, or an instruction the scientist needs at that moment.

- Delete every sentence that explains what the tool is, what a section is for, or why the design is the way it is. `For the hypothesis to hold, each link must be true.` goes. `Shows what was extracted — design, blinding, n — before anything runs.` stays only if the extraction itself does not make it obvious; test it.
- No adjectives or adverbs of degree in text the tool writes: no `very`, `only`, `strong`, `clear`, `powerful`, `robust`, `comprehensive`, `seamless`, `intuitive`, `insight`. Quoted study titles are exempt.
- No `AI`, `magic`, `smart`, `intelligent`, `powered`. No sparkle. No emoji.
- No label above a thing that is already legible as itself. A kicker earns its place by naming a group the eye cannot otherwise separate.
- Every button is a verb or a noun the scientist would say: `Read`, `Appraise ambroxol`, `Export appraisal`, `Copy link`, `open`. Never `Learn more`, `Get started`, `Explore`.
- Names already on screen keep their spelling: `critical appraisal`, `mechanism`, `safety`, `before a trial`, `your call`, `sources`, `export appraisal`, the five labels, the six status rules.
- Budget: Entry under 30 words at rung 0; a results row under 25; Detail rung 0 under 120. Count them in the design note.
- Write every user-facing string once, in one file, so a reviewer can read the whole product's vocabulary on a page.

## 7. Process

1. **Design note first.** `docs/redesign/2026-09-20-note.md`: the material system chosen and the two you tried, the palette with ratios, the type scale, the ladder for each screen, the formats kept and dropped with a screenshot of each, the word budget per screen. Two directions at low fidelity for the nilotinib Detail page, screenshotted, one chosen with a reason. Keep it short; screenshots carry it.
2. **Nilotinib end to end before anything else.** Entry → Working → Results → Detail → Export → Sources, for `parkinsons-disease` and `nilotinib`, at all three cutoffs, in the final design. Then metformin (drug-first: rows are conditions; class and fine print move to the page header) and the pair route.
3. **Commit at each screen** with a message that names what changed and why. Do not commit `dist/`.
4. **Critique as a seasoned drug-discovery expert** after each screen: what would they say is missing, what would they say is decoration. Fix it before moving on.

## 8. Verify, then verify again

Run all of it and put the results in the design note. A step that fails is reported as failed, with the output.

```sh
npm test                 # unchanged tests must pass
npx tsc -b               # no type errors
npm run build            # the bundle builds; note its size against the current one
```

- Screenshot every route at 1440 and 1280 px, and the Detail page at each of the three cutoffs. Put them in `docs/redesign/shots/`. Look at each one before you call it done.
- Under `prefers-reduced-motion: reduce`, walk the demo: no startup screen, no ripple, every surface present, nothing waits on an animation.
- Keyboard only, from `/`: reach the objection's evidence, the claim panel, the fifth prerequisite, the export, and a source popover; Escape closes what Escape should; focus is visible everywhere and never lost.
- Contrast: compute the ratio of every text token on every ground it appears on and print the table. Nothing under 4.5:1 for text or 3:1 for lines and the label squares.
- Print `/q/parkinsons-disease/nilotinib/export` to PDF: everything legible, no animation artefacts, the data note on the page.
- Grep every string on screen against §6's banned list, and count words per screen at rung 0 against the budget.
- The two-minute test, on yourself with a fresh eye and on one teammate: open `/q/parkinsons-disease/nilotinib`, start a timer, and state the strongest argument against nilotinib and its weakest link. Record the answers verbatim in the note. The right answers are brain exposure (`0.53 %`) and the crossing into the brain (`c4`).
- The backtest: at `?asof=nov-2017` exactly three objections (exposure, uncontrolled, biomarker) and no post-trial one; at `?asof=jul-2016` two, the MAO-B objection absent; today, four. `4 of 5 unresolved` today.
- With the network off, Detail still renders the drawing and the pathway panel says so.

## 9. Deliverables

- The redesigned app, all routes, nilotinib complete at three cutoffs, metformin and the pair route complete.
- `docs/redesign/2026-09-20-note.md` with screenshots and the verification results.
- `DESIGN.md` and `design/tokens/*` rewritten to describe what you built, not what was there. `README.md`'s screen table updated if a screen's shape changed.
- A list, in the note, of every string that was on the old interface and is not on the new one, with the reason each was cut.
