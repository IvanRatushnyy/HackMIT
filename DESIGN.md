# elute — design

**elute** is a drug-repurposing decision tool, built for the Regeneron challenge at HackMIT 2026. Given a condition, an approved drug, or a drug–condition pair, a backend ranks repurposing candidates. The frontend does the part no ranking tool does: it puts the strongest case *against* each candidate on screen first, labels every link in the mechanism chain as established, contested, single-source, unknown, or refuted, and never pretends to be more certain than it is. It organizes evidence for a scientist who is qualified to weigh it. It never recommends.

To elute is to wash a mixture through a column so that its compounds come out one at a time, separated. The tool does the same to a hypothesis: what is known comes apart from what is merely believed. The startup screen shows exactly that.

## Files

```
HackMIT/
├── DESIGN.md                 this document
├── .impeccable.md            design context for AI design tooling
├── docs/redesign/            the 20 Sep notes, screenshots (shots/restore is the current state), shot scripts
├── docs/superpowers/specs/   the design specs and their review history
├── src/
│   ├── styles/base.css       reset, type roles, page frame, header, shard and flow, the paper material, controls, labels, motion
│   ├── styles/<screen>.css   splash, entry, working, results, detail, pathway, sources, export
│   ├── lib/shard.ts          the mark read into planes the components animate one by one
│   ├── lib/splash.ts         the startup screen's timeline
│   └── lib/motion.ts         the Motion vocabulary: curves, durations, arrive, stagger, presence
└── design/
    ├── palette.md            the four colors, roles, contrast, rules
    ├── shard/shard.svg       the brand composition, exported from the mockup
    ├── fonts/                Aujournuit (the wordmark and the titles) and Supreme (everything else), with metric-matched fallbacks
    └── tokens/               colors.css, space.css, typography.css, index.css
```

`src/main.tsx` imports `design/tokens/index.css` once, then `base.css`, then one stylesheet per screen. Every stylesheet is one generation: no overrides of overrides.

## Who it is for

- **The accountable expert.** A translational scientist or physician-scientist in pharma. Deep domain expertise; time-poor; skeptical of AI by default; professionally on the hook for being wrong. Not a command-line user, so the interface is the product's only door. Knows more biology than the model and wants their own judgment amplified, not replaced. Laptop and desktop first; the demo runs on a projector. The judge of this challenge *is* this person.

Job to be done: handed an AI-generated repurposing candidate, see why it might be wrong before why it might be right, find which link in the chain is established and which is one unblinded pilot, and defend or kill the candidate to a colleague in your own words.

The test the design has to pass: a domain expert who has never seen the tool, shown the Detail view for one candidate, can within two minutes and without being told what to decide state the strongest argument against the candidate and name its weakest evidentiary link.

## Personality

**Quiet, exact, skeptical.** Confidence that comes from showing its work. A peer review, not a press release. Doubt is presented as rigor: the counter-case is the most polished element on the page, not a disclaimer box. Emphasis is carried by weight and placement, never by flashing, glow, or noise.

## The material: paper on the sunken page

The page is the sunken neutral (`--color-surface-sunken`). Every reading surface is white paper with one 1px dust line and sharp corners, like the shard's planes: the results registers, the pipeline boxes, the facts strip, the objections, the pathway, safety, the five prerequisites, your call, the ledger, the export preview. No blur, no shadow, no glow. Rows inside a panel are separated by hairlines; sections by whitespace. Controls are sharp too; the only round things are the radio dots. One accent (slate); raspberry is rare by rule. While a step is running its box carries a 2px ink border and a slate bar filling beneath it.

## The six moments

| Moment | The person should feel | Treatment |
|---|---|---|
| Startup | "I understand the name." | The hero from the mockup, once per load: the wordmark at 128px on a white band, the shard beneath. The planes compose topmost first, the wordmark fades in, the hero holds a second, the planes come apart ground first, and the wordmark travels into the header while the page fades in beneath. About three seconds; reduced motion skips it. |
| Appraise | "I understand what this does in five seconds." | Under the flow, one centred stack with the same air above and below: `prove it to me`, one sentence, the field with one rule of ink under it and `appraise →` at its end, three example words. Nothing else: the header band is the page's brand element. |
| Working | "It's doing real work, and I can follow it." | Ten boxes on paper, one per check, each with its question, its source and, when done, what came back as one count. The current box is in ink with a slate bar filling beneath it; boxes ahead are faint with a dashed line. Under the grid, the current step's records arrive one by one. Click a finished box for its records. |
| Results | "I can triage this in fifteen seconds." | Two registers, *not yet tested against placebo* and *tested in placebo-controlled trials*. Rows on one paper panel: rank, the name in Medium at 20px with class and mechanism beneath, then the three things a scientist asks first: the best human evidence as an outlined outcome word with design and n, the weakest link in a sentence, the safety flag as a raspberry word with its reason. The board by stage remains. |
| Detail | "I can defend or kill this myself." | The name at 96px, class and indication beneath, the evidence date at the right. A paper strip of the three answers and a page map. Then the numbered sections: *the case against*, objections by consequence, each opening to its evidence sentence and dated sources; *the pathway*, the hypothesis drawn as biology, every action's stroke and word from the evidence rules, the weakest link marked, the claim panel opening beneath; *safety* and *before a trial* (five paper boxes) side by side; *your call*. |
| Sources | "I can see exactly what it did." | The run's ledger with every record numbered; a row opens to what was consulted; tool calls, packages and the status rules on secondary tabs. |
| Export | "I can take this with me." | Format and includes beside a preview typeset like the page. |

## Typography

Two faces, self-hosted in `design/fonts`, with metric-matched fallbacks so text does not jump on load. Aujournuit is for the titles that matter most, about a tenth of the type on any page; Supreme is the rest.

| Role | Face | Setting | Use |
|---|---|---|---|
| Wordmark | Aujournuit | Airy width (`font-stretch: 175%`), tracking −2%, lowercase | The header wordmark (48px) and the startup hero (128px). Nowhere else. |
| Display | Aujournuit | Regular width (100%), tracking −2%, **always lowercase** | The landing headline, the Detail title (96px), page titles (40px), section titles (28px), and the numerals on objections, prerequisites and the unresolved count |
| Names | Supreme | Medium 500, 20/32 | A candidate's name in a row, a register's word, a pipeline question, the feed title |
| Text | Supreme | Regular 400, tracking −4% | Everything else: body, rows, controls, the flow, the pathway's words |
| Emphasis | Supreme | Medium 500 | Interactive labels, the current item, kickers, the evidence-label word |
| Headline figure | Supreme | Bold 700 | Only the one figure that carries an argument, such as *n = 12* |
| Raw | System monospace | Regular | The tool-call blocks on Sources only |

Scale: 12/16, 14/24, 16/24, 20/32, 28/32, 40/48, plus 96/88 for the Detail title. Every line height is on the 8px grid. Aujournuit is set in lowercase everywhere it appears; Supreme keeps normal casing; nothing is set in all caps. Body measure caps at 65ch. Neither face has tabular figures, so columns of numbers are right-aligned (`.figure`).

## Color

Read `design/palette.md`. In short: white `#fbfcfe` is the paper; the page beneath it is the sunken neutral; ink `#06070e` is the text, the rules, the primary button and the *established* label; slate `#47667d` is the one recurring accent (links, selection, the running bar, *contested*); dust `#d3d3d3` is lines and the ground of the shard; raspberry `#82204a` is rare (*single-source*, *refuted*, the safety flag, the negative outcome, the weakest link). All neutrals are tinted toward hue 276. Contrast on paper: ink 19.6:1, raspberry 9.1:1, slate 5.9:1, muted text 5.4:1.

Evidence labels are never color alone: an 8px square in the label's color sits before the word, and on the drawing the stroke repeats the label (3px solid established, 2px dashed contested, 2px short-dashed single-source, 1.5px dotted unknown, 2px solid raspberry refuted).

## The shard

`design/shard/shard.svg`: thirteen planes in the four colors, a mixture coming apart into bands. It is the startup hero and the band in the 120px header on every page, cropped to its dense middle, from the edge of the wordmark's white block across the rest (`Shard` in `src/components/frame.tsx`). It composes plane by plane once, when the startup screen lifts, and then stands still: the same band on every page. It is never placed behind text.

## The flow

Under the header on every page, centred: the five stages, `1 ask` to `5 share`, each an icon in a sharp 32px box with its number and word, joined by hairlines; the current stage's box is ink (`Stages` in `src/components/Stages.tsx`, rendered by `Header`). It is the only wayfinding, so no page repeats its stage as a kicker, and no section carries a sentence explaining what it is for.

## Icons

Every icon is from Phosphor (`@phosphor-icons/react`, MIT), Regular weight at 16px unless it is the one arrow in a button (Bold) or the arrow on a results row (20px): the five stages, the twelve checks of the pipeline and their check mark, the plus and minus that open a row, the close on the claim panel. Nothing is drawn by hand; the shard and the pathway are drawings, not icons.

## Motion

State changes only, on opacity, transform and blur; ease-out curves, 120/240/400/640 ms from the tokens, the Motion library (`motion/react`) for choreography and CSS keyframes for the shard.

- The shard composes and decomposes plane by plane, 40ms apart, 240ms each: in from the topmost plane down to the ground, out from the ground up to the topmost; the two ground pieces sit a further 80ms apart (`--shard-fade`, `--shard-stagger`, `--shard-ground-gap`).
- Startup: the hero composes, holds, decomposes; the wordmark travels into the header (FLIP); then the header band composes once (`--band-cascade`, 800ms; `src/components/Splash.tsx`, `src/lib/splash.ts`). On later pages it mounts composed.
- The flow fades in stage by stage, 40ms apart (`.fade`): after the band on the first page, at once on later pages. When the stage changes within a page the ink box moves over 240ms.
- A page arrives as one reveal: blocks come in at 102% and soft, settling to size over 640ms, 40ms apart (`.arrive`). On Entry the blocks wait under the startup screen and arrive after the band and the flow.
- Working: each step about 2.6s; the current box's bar fills over its duration; its records arrive one by one.
- Detail: the objections re-lay themselves out when the evidence date changes; the drawing reveals each action from its source in the order of the argument, status words after; the claim panel enters under its block.
- Everywhere: hover settles over 240ms, press scales to 0.98, a row expanding is a height change on the grid. `prefers-reduced-motion` collapses every duration through the tokens and skips the startup screen.

## The 8px grid

- **Spacing** uses only the scale in `space.css`: 8, 16, 24, 32, 48, 64, 96. No 10px, no 12px, no 20px, and no 4px between elements. If a composition needs something in between, change the composition, not the scale.
- **Sizes** snap to the grid: controls are 32, 40 or 48px tall, icons are 16 or 24px, the header is 120px, the pipeline boxes 168px, the prerequisite boxes 144px.
- **Line heights** are multiples of 8, so stacked text lands back on the grid; stacked lines need no gap between them.
- **Vary spacing for hierarchy** within the scale: 8 and 16 inside a group, 32 and 48 between groups, 64 between sections and between the landing's title and its field.
- **Use `gap`** for sibling spacing rather than margins.
- The one deliberate exception is the header block's 40/45px inset around the wordmark, set optically against the mark.

## Principles

1. **The counter-case is the headline.**
2. **Known vs. believed, labeled on every claim.** Never a bare number.
3. **Doubt reads as rigor.** Emphasis by weight and placement.
4. **Show the work, never force it.** Sources one click away; every citation lands on the Sources page.
5. **Say what is synthetic.** On the Sources page and in every export.
6. **Never a recommendation.** The scientist decides.
7. **The shard is the brand.** The hero once, the band on every page; never behind text.
8. **One grid, one scale.** 8px everywhere.

## Not this

Glass, blur or glow on any surface. Dark "AI lab" dashboards with cyan glow. Chat bubbles. Sparkle icons. Icons above headings. Red, amber, green confidence lights. Bare percentage scores. Gradient text. Colored side stripes. A kicker above every block. An em-dash in text the tool writes. A sentence that explains what a section is for. A tab or button that leads nowhere. Anything that looks like a pitch deck.
