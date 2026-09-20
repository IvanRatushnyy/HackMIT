# elute — design

**elute** is a drug-repurposing decision tool, built for the Regeneron challenge at HackMIT 2026. Given a condition, an approved drug, or a drug–condition pair, a backend ranks repurposing candidates. The frontend does the part no ranking tool does: it puts the strongest case *against* each candidate on screen first, labels every link in the mechanism chain as established, contested, single-source, unknown, or refuted, and never pretends to be more certain than it is. It organizes evidence for a scientist who is qualified to weigh it. It never recommends.

To elute is to wash a mixture through a column so that its compounds come out one at a time, separated. The tool does the same to a hypothesis: what is known comes apart from what is merely believed. The startup screen shows exactly that.

## Files

```
HackMIT/
├── DESIGN.md                 this document
├── .impeccable.md            design context for AI design tooling
├── docs/redesign/            the 20 Sep redesign note, screenshots, the type specimen, screenshot scripts
├── src/
│   ├── styles/base.css       reset, type roles, page frame, header, the block material, controls, labels, motion
│   ├── styles/<screen>.css   splash, entry, working, results, detail, pathway, sources, export
│   └── lib/motion.ts         the Motion vocabulary: curves, durations, arrive, stagger, presence
└── design/
    ├── palette.md            the four colors, roles, contrast, rules
    ├── shard/shard.svg       the brand composition, exported from the mockup
    ├── fonts/                Lusitana and Instrument Sans, with licences
    └── tokens/               colors.css, space.css, typography.css, index.css
```

`src/main.tsx` imports `design/tokens/index.css` once, then `base.css`, then one stylesheet per screen.

## Who it is for

- **The accountable expert.** A translational scientist or physician-scientist in pharma. Deep domain expertise; time-poor; skeptical of AI by default; professionally on the hook for being wrong. Not a command-line user, so the interface is the product's only door. Knows more biology than the model and wants their own judgment amplified, not replaced. Laptop and desktop first; the demo runs on a projector. The judge of this challenge *is* this person.

Job to be done: handed an AI-generated repurposing candidate, see why it might be wrong before why it might be right, find which link in the chain is established and which is one unblinded pilot, and defend or kill the candidate to a colleague in your own words.

The test the design has to pass: a domain expert who has never seen the tool, shown the Detail view for one candidate, can within two minutes and without being told what to decide state the strongest argument against the candidate and name its weakest evidentiary link.

## Personality

**Quiet, exact, skeptical.** Confidence that comes from showing its work. A peer review, not a press release. Doubt is presented as rigor: the counter-case is the most polished element on the page, not a disclaimer box. Emphasis is carried by weight and placement, never by flashing, glow, or noise.

## The material: glass on a living ground

Under every page is the ground: a slow mesh gradient in the brand's tints (paper, slate, raspberry, dust), drifting the way a mixture drifts down a column (`src/components/Ground.tsx`, Paper's `@paper-design/shaders-react`, MIT, WebGL). It is still under reduced motion and hidden under reduced transparency. Every reading surface is glass over it: a translucent sheet at a 16px radius with a hairline of light along its inside edge and a soft ink shadow beneath. Rows inside a sheet are separated by hairlines; sections by whitespace. Controls on the glass stay solid and sharp (radius 0); the only circles are the two buttons in the ask box and the radio dots. One accent (slate); raspberry is rare by rule, and a raspberry glow gathers at a sheet's rim while something is happening on it (the field has focus, the ledger is running).

The startup screen is glass over the same ground, so it dissolves into the first page rather than cutting to it. The header is a glass bar with the wordmark alone; the ground carries the brand's colour. Controls share one soft radius (8px); sheets are 16px.

## The six moments

| Moment | The person should feel | Treatment |
|---|---|---|
| Startup | "I understand the name." | Over the ground: the wordmark at 96px settling from Wide to Airy along its width axis; beneath it a column in which one dark mixture separates into four bands, ink, slate, dust-grey, raspberry, each band's word appearing at the detector as it lands. About three seconds, once per load. |
| Appraise | "I understand what this does in five seconds." | One glass sheet centred under the header: the field, the + and send circles inside it, three example chips beneath that teach the three modes. The ground drifts behind it. Nothing else. |
| Working | "It's doing real work, and I can follow it." | A strip of ten marks, then the run one step at a time: the current step in focus with its question, its source, its records arriving one by one and its count, a bar filling beneath; finished steps above it as one line each, opening on a click; nothing shown ahead. No spinner, no percentage. |
| Results | "I can triage this in fifteen seconds." | Two registers, *Tested in placebo-controlled trials* and *Not yet tested against placebo*, each with its rule printed once beneath. Rows on one sheet: rank, class in Medium at 20px, the name beneath, the fine print when the record has it, and four answer cells under the four questions. A row opens in place into a four-step walk. The board by stage remains. |
| Detail | "I can defend or kill this myself." | The name at 80px, then class, mechanism, best evidence, the drivers; the evidence date at the right. *Critical appraisal* first: objections numbered by consequence, each opening to its evidence sentence in the reading serif with its sources and ledger citations. *Pathway*: the hypothesis drawn as biology on its sheet, revealed action by action, every action labelled by the evidence rules, the weakest link marked, the claim panel opening beneath; the fine print and the Reactome thumbnail folded under a disclosure. *Safety* and *before a trial* (five glass boxes, a walkthrough) side by side. *Your call*. |
| Sources | "I can see exactly what it did." | The run's ledger with every record numbered; a row opens to what was consulted; tool calls, packages and the status rules on secondary tabs. |
| Export | "I can take this with me." | Format and includes beside a preview typeset like the page. |

## Typography

Two faces from Google Fonts (OFL), self-hosted in `design/fonts`.

| Role | Face | Setting | Use |
|---|---|---|---|
| Display | Lusitana | Regular (Bold available), tracking −1%, **always lowercase** | Wordmark (40px), the Detail title (96px), page titles (40px), section titles (28px), the numerals on objections, prerequisites and the running step |
| Text | Instrument Sans | Regular 400, tracking −1%, tabular figures on `.figure` | Everything else: interface text, rows, controls, and what the record says |
| Emphasis | Instrument Sans | Medium 500 | Interactive labels, the current item, the class on a results row, the label word, the question of the running step |
| Headline figure | Instrument Sans | Bold 700 | Only the one figure that carries an argument, such as *n = 12* or *0.53 %* |
| Reading | Instrument Sans | 18/28 | An objection's evidence sentence: a size up, the same face |
| Raw | System monospace | Regular | The tool-call blocks on Sources only |

Scale: 12/16, 14/24, 16/24, 20/32, 28/32, 40/48, plus 96/88 for the Detail title and 18/28 for an evidence sentence. Nothing is set in all caps. Body measure caps at 65ch.

## Color

Read `design/palette.md`. In short: paper `#fbfcfe` is the page; ink `#06070e` is the text, the rules, the primary button and the *established* label; slate `#47667d` is the one recurring accent (links, selection, *contested*); dust `#d3d3d3` is lines and inactive shard planes; raspberry `#82204a` is rare (*single-source*, *refuted*, the safety flag, the negative outcome, the weakest link). Slate and raspberry each have three OKLCH steps in the tokens (deep, mid, tint). Contrast on paper: ink 19.6:1, raspberry 9.1:1, slate 5.9:1, muted text 5.4:1.

Evidence labels are never color alone: an 8px square in the label's color sits before the word, and on the drawing the stroke repeats the label (3px solid established, 2px dashed contested, 2px short-dashed single-source, 1.5px dotted unknown, 2px solid raspberry refuted).

## The shard

`design/shard/shard.svg`: thirteen planes in the four colors, a mixture coming apart into bands. On screen it appears as the four bands of the startup column and as the tints of the ground; the composition itself is the mark for print and the deck. It is never placed behind text.

## Motion

One orchestrated moment per screen, and motion that answers an action. Curves and durations are tokens (`--ease-out`, 120/240/400/640 ms); the Motion library (`motion/react`) carries the choreography, `src/lib/motion.ts` the shared vocabulary.

- Startup: the elution (bands 3.2 to 5.9 s, staggered), the wordmark's tracking settling, a 400 ms lift.
- Entry: the sheet arrives after the startup screen lifts; submitting sends one ripple outward and the ledger page arrives on its wake.
- Working: the person is walked through the run one step at a time, about 2.6 s each. Only the current step moves: its question, then its source, then its records one by one, then the count; a bar fills under it. Finished steps settle above it as one line each and open on a click; steps not yet reached are not shown, the strip says how many remain.
- Detail: the objections list re-lays itself out when the evidence date changes, entries arriving and leaving; the drawing reveals each action from its source in the order of the argument, status words after; the claim panel and a prerequisite's note enter under their block; the count of objections and of unresolved prerequisites crossfades.
- Everywhere: hover settles over 240 ms, press scales to 0.98, a row expanding is a height change on the grid. `prefers-reduced-motion` collapses every duration through the tokens and skips the startup screen.

## Principles

1. **The counter-case is the headline.**
2. **Known vs. believed, labeled on every claim.** Never a bare number.
3. **Doubt reads as rigor.** Emphasis by weight and placement.
4. **Show the work, never force it.** Sources one click away; every citation lands on the Sources page.
5. **Say what is synthetic.** On the Sources page and in every export.
6. **Never a recommendation.** The scientist decides.
7. **The shard is the brand.** Once per flow, with restraint.
8. **One grid, one scale.** 8px everywhere.

## Not this

A flat grey ground. Glass on controls. Dark "AI lab" dashboards with cyan glow. Chat bubbles. Sparkle icons. Icons above headings. Red, amber, green confidence lights. Bare percentage scores. Gradient text. Colored side stripes. A kicker above every block. Meta lines joined with middle dots. An em-dash in text the tool writes. A sentence that explains what a section is for. A tab or button that leads nowhere. Anything that looks like a pitch deck.
