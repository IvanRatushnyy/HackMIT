# elute — design

**elute** is a drug-repurposing decision tool, built for the Regeneron challenge at HackMIT 2026. Given a condition, an approved drug, or a drug–condition pair, a backend ranks repurposing candidates. The frontend does the part no ranking tool does: it puts the strongest case *against* each candidate on screen first, labels every link in the mechanism chain as established, contested, single-source, unknown, or refuted, and never pretends to be more certain than it is. It organizes evidence for a scientist who is qualified to weigh it. It never recommends.

To elute is to wash a mixture through a column so that its compounds come out one at a time, separated. The tool does the same to a hypothesis: what is known comes apart from what is merely believed.

## Files

```
HackMIT/
├── CLAUDE.md                 project context for Claude: what elute is, principles, stack, domain rules
├── DESIGN.md                 this document
├── .impeccable.md            design context for AI design tooling
├── PRD Elute.md              product requirements: problem, person, demo story, six moments, the cut
├── docs/
│   ├── sponsor-conversations.md  distilled Henry Wei (Regeneron) conversations and starter kits
│   ├── BACKEND_PLAN.md       backend: fills the frontend's DataSource seam; pipeline, API, work split
│   └── superpowers/specs/    the frontend design spec and its review history
├── package.json              the app (Vite + React + TypeScript) and html2canvas-pro for the vendored glass layer
├── src/                      the app; src/styles/base.css and screens.css are the only stylesheets
└── design/
    ├── palette.md            the four colors, roles, contrast, rules
    ├── shard/shard.svg       the brand composition, exported from the mockup
    ├── glass/
    │   ├── README.md         how to load the glass layer, its constraints and fallbacks
    │   ├── glass-theme.css   brand overrides for the glass controls
    │   ├── glass.config.js   the elute glass preset (window.glassControls)
    │   ├── liquid-glass.d.ts ambient types for the library's globals
    │   └── vendor/           liquid-glass-js, unmodified, pinned commit, MIT
    ├── fonts/
    │   ├── Aujournuit-VariableVF.ttf   display, width axis 50–200
    │   ├── Supreme-Variable.ttf        text, weight axis 100–800
    │   ├── Supreme-VariableItalic.ttf  text italic, weight axis 100–800
    │   └── fonts.css                   @font-face and metric-matched fallbacks
    └── tokens/
        ├── index.css         imports everything below, in order
        ├── colors.css        primitives, neutral ramp, semantic and evidence-label tokens
        ├── space.css         8px grid: spacing, sizes, layout, shape, motion
        └── typography.css    families, tracking, weights, type scale, text roles
```

`src/main.tsx` imports `design/tokens/index.css` once; everything else uses the semantic tokens and the classes in `src/styles/`.

## Who it is for

- **The accountable expert.** A translational scientist or physician-scientist in pharma. Deep domain expertise; time-poor; skeptical of AI by default; professionally on the hook for being wrong. Not a command-line user, so the interface is the product's only door. Knows more biology than the model and wants their own judgment amplified, not replaced. Laptop and desktop first; the demo runs on a projector. The judge of this challenge *is* this person.
- **The IT/security reviewer.** Wants to see what the agent actually called, what packages it depends on, and whether anything is inappropriate for an enterprise environment. Served by depth on demand, never by clutter on the main surfaces.

Job to be done: handed an AI-generated repurposing candidate, see why it might be wrong before why it might be right, find which link in the chain is established and which is one unblinded pilot, and defend or kill the candidate to a colleague in your own words.

The test the design has to pass: a domain expert who has never seen the tool, shown the Detail view for one candidate, can within two minutes and without being told what to decide state the strongest argument against the candidate and name its weakest evidentiary link.

## Personality

**Quiet, exact, skeptical.** Confidence that comes from showing its work. A peer review, not a press release. Doubt is presented as rigor: the counter-case is the most polished element on the page, not a disclaimer box. Emphasis is carried by weight and placement, never by flashing, glow, or noise.

## The six moments

Every screen is one of these, and each has a fixed treatment.

| Moment | The person should feel | Treatment |
|---|---|---|
| Appraise | "I understand what this does in five seconds." | One glass box, a chat composer, alone and centred in the space under the header: the field, a **+** circle that opens *paste a paper* beneath the box (it shows what was read — design, blinding, n — before anything runs), and the ink send circle. Nothing else on the page. |
| Working | "It's doing real work, not stalling." | The evidence ledger in a panel: numbered rows with a ✓ / ! / ● glyph, the step, what came back with its real source, and the elapsed time when a run was recorded. The running row is tinted, with a 2px bar filling over the step's duration, and the ledger's shadow is raspberry until the last step completes; pending rows are faint. A finished step's records open in a panel beside it. A status line says *step 6 of 10 · 0:31 · scripted, about 12 s · results open when done*. No spinner. |
| Results | "I can triage this in fifteen seconds." | A table in a panel, grouped *not yet refuted* / *refuted in controlled studies*, ordered by fewest unresolved trial prerequisites — never by a score, and the sub line says so. Each row: rank, the candidate in Aujournuit with its mechanism under it, the best evidence as an outlined outcome chip with design and n, the weakest link in a sentence, safety as a raspberry word with its reason or *none flagged*, the unresolved count. A *board* view lays the same candidates out by trial stage. |
| Detail | "I can defend or kill this myself." | One column. *Critical appraisal* first: numbered objections in a panel, each expanding to its evidence sentence and dated sources. Then *mechanism*: a horizontal chain, nodes as boxes, each link carrying its label square and word, a caption, and *weakest link* on one of them; selecting a link opens its claim and evidence below. Then *safety* and *before a trial* side by side. Then *your call* with reasoning and *Export appraisal*. *Evidence as of* sits top right and freezes the whole page at a date. |
| Sources | "I can see exactly what it did." | The run's ledger with every record numbered (1.1, 2.2 …), the tool calls in system mono, the packages, and the status rules that assign each label. Citations on Detail land here. |
| Export | "I can take this with me." | Format (Markdown, JSON, print), what to include, and a live preview built from the same dated model the page shows. The evidence date and the data note travel with the document. |

The pages carry no data note. The curated-data statement lives on the Sources page (what is curated, what is draft, what real data this would run on, what the tool is not) and travels with every exported document.

## Typography

| Role | Face | Setting | Use |
|---|---|---|---|
| Display | Aujournuit | Regular width (`font-stretch: 100%`), tracking −2%, weight 400, **always lowercase**; the wordmark alone is Airy (`175%`) | Wordmark (48px), page titles (40px), section titles and row names (28px) |
| Kicker | Supreme | 12px Medium, lowercase, tracking −4% | The small label above a title or a panel: *paste a paper*, *claim*, *evidence*, table headers |
| Text | Supreme | Tracking −4%, Regular 400 | Body, labels, tables, controls, the chain: everything that is not a big title |
| Emphasis | Supreme | Medium 500 | Interactive labels, the current item, a candidate's name in the results, the evidence-label word |
| Headline figure | Supreme | Bold 700 | Only the one figure that carries an argument, such as *n = 12* or *0.53%* |
| Annotation | Supreme Italic | Regular 400 | Dates and sources under a claim, the data banner, caveats |
| Raw | System monospace | Regular | The tool-call blocks on Sources only. There is no brand mono; the system's is honest enough for tool calls. |

Scale for product UI is fixed in rem, ratio about 1.25, and every size pairs with a line height on the 8px grid:

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-xs` | 12px | 16px | Captions, dates, source lines |
| `--text-sm` | 14px | 24px | Secondary UI, metadata, evidence labels |
| `--text-md` | 16px | 24px | Body |
| `--text-lg` | 20px | 32px | Section headings |
| `--text-xl` | 28px | 32px | Key figures, the confidence figure |
| `--text-2xl` | 40px | 48px | The headline figure |

Aujournuit is set in lowercase everywhere it appears; Supreme keeps normal casing (MONDO ids, *NILO-PD*, drug classes). Nothing is set in all caps: no uppercase kickers, tags, or table headers, ever. The only capitals are the ones a name already carries (MONDO and NCT ids, *NILO-PD*, an abbreviation). Body measure caps at 65ch.

Notes from the font files:

- Aujournuit has one weight and five named widths: Condensed 50, Densed 75, Regular 100, Airy 175, Wide 200. Regular is used everywhere except the wordmark, which is Airy.
- Aujournuit supports `ss01`, `dlig`, `frac`, `ordn` and `sups`. Supreme supports `salt`, `frac`, `ordn` and `sups`.
- Neither face has tabular figures. Columns of numbers are right-aligned with the `.figure` class rather than relying on equal digit widths.
- Fallback faces in `fonts.css` carry the real fonts' ascent and descent so text does not jump on load.

## Color

Read `design/palette.md` for the full table. In short:

1. **White** `#fbfcfe` is the page. Tinted toward the ink hue, never pure.
2. **Black** `#06070e` is the ink, primary buttons, the dominant shard, and the *established* label.
3. **Slate** `#47667d` is the main highlight and the only recurring color: selection, links, active controls, the *contested* label.
4. **Dust grey** `#d3d3d3` is a secondary accent for dividers, inactive shards, and disabled states.
5. **Raspberry** `#82204a` is a secondary accent that stays rare: the *single-source* and *refuted* labels, the safety flag, the *negative* outcome chip, destructive actions, and the ask box's shadow while its field has focus.

The page is the sunken neutral (`--color-surface-sunken`); every reading surface is glass (see Glass): translucent white at a 24px radius with a hairline of light and a soft shadow behind it. The controls on the glass (chips, segments, chain nodes, buttons, the radio dots aside) stay solid and sharp.

All neutrals are tinted toward hue 276, the black's hue, at chroma 0.003 to 0.016. Contrast is verified against the white surface: black 19.6:1, raspberry 9.1:1, slate 5.9:1, muted text 5.4:1.

Evidence labels are never color alone: an 8px square in the label's color sits before the word, *single-source* carries its qualifier (n, blinding, replication), and a chain link's line repeats the label (solid for established and refuted, dashed for contested and single-source, dotted for unknown). What set a candidate's rank is a driver bar of four named segments with three monochrome pips each — never a number.

## The shard

The one unforgettable element is the composition from the mood board: large intersecting curved planes in black, slate, raspberry, and dust, a mixture coming apart into bands the way compounds separate as they elute. It is the brand mark and the band beside the wordmark in the 120px header on every page (`design/shard/shard.svg`, cropped to its dense middle). It is never placed behind body text or the counter-case, and it is the only decoration allowed.

## Glass

Glass is the surface material of the whole flow, a reversal of the v1 rule that kept it off reading surfaces. Every panel — the ledger, the step aside, results groups and board cards, objections, the claim panel, safety, before a trial, the sources ledger and packages table, export's include list and preview, paste a paper — and the ask box on Entry are the same glass, the stylesheet's own (`.panel` and `.ask` in `src/styles/base.css`): a translucent white surface at a 24px radius, a hairline of light along its inside edge, and a soft shadow behind it, inset from the top and let out below, so it shows through the lower part of the surface and spills out beneath. Row fills and dividers on glass are translucent ink. While something is happening on a surface — the ask field has focus, the ledger is running — a raspberry glow spreads from the shadow's edge and gathers along the rim, inside and out, over 640ms. `prefers-reduced-transparency` makes every surface solid white; print does too.

The shadow is the panel's own `::before` at z-index −1, which sits behind the panel's background only while the panel is not a stacking context, so a panel never carries a transform, filter, opacity, or backdrop-filter of its own: the block that arrives is a wrapper around it. The ask box, which does animate, keeps its shadow as a sibling for the same reason (and can afford a backdrop blur). On Entry nothing is suggested while typing; Enter resolves the best match through the entity index, and an unmatched string gets a note instead of a dead end.

The vendored WebGL library is kept for a control that would float over the shard or the chain: [liquid-glass-js](https://github.com/dashersw/liquid-glass-js), a WebGL refraction library in `design/glass/vendor`, with the elute preset in `design/glass/glass.config.js` and brand overrides in `design/glass/glass-theme.css`. Wiring and constraints are in `design/glass/README.md`. It was tried for the ask box and set aside: it refracts a one-time html2canvas snapshot of the page, so it can only appear once the box's arrival has finished, cannot show a change such as the focus glow, and draws at 1×, soft on a 2× display. Over a flat page it added nothing the stylesheet could not.

Where the library may appear, when a floating control returns: a pill container of pill buttons over the shard or over the chain. Never as a panel: the stylesheet's glass is the panel material.

Rules:

- **Readable first.** Labels on glass are ink on a light tint. Keep `tintOpacity` at 0.3 or above so ink stays at 4.5:1 or better over the darkest part of the shard or the chain.
- **Quiet optics.** Low ripple, low centre distortion, soft blur. The refraction should be noticed on the second look, not the first. The preset in `glass.config.js` is the starting point; tune it over the real shard and chain.
- **Grid holds.** Glass containers use 8px padding and gap; buttons are 40 or 48px tall. Pills and circles are the one place corners are round: solid surfaces are sharp like the shard, floating controls are soft.
- **Same states as everything else.** Hover lifts by 1px, press scales to 0.98, focus shows the slate ring. Transform and opacity only.
- **Degrade honestly.** No WebGL or `prefers-reduced-transparency` gives a solid white surface with a 1px line and a light backdrop blur, same markup, same size. The ask box goes solid white under `prefers-reduced-transparency`.
- **Know the cost.** The library snapshots the page once. If the chain is drawn on a canvas it must be created with `preserveDrawingBuffer`, and the snapshot refreshed after the chain settles (pan, zoom, a link expanding). An SVG or DOM chain is captured directly. Few, small glass elements.

## Principles

1. **The counter-case is the headline.** Every Detail view answers "what would kill this?" before anything else, and answers it as the most polished block on the page.
2. **Known vs. believed, labeled on every claim.** Established, contested, single-source, or unknown, on every link, always with its word and its source. *Unknown* is a valid and valuable label. Never a bare number: confidence is always one click from its drivers.
3. **Doubt reads as rigor.** Emphasis by weight and placement; the rare use of raspberry marks the weakest link and the safety flag. No alarm styling, no disclaimer boxes.
4. **Show the work, never force it.** Sources one click away; every citation lands on the Sources page, where the ledger, the tool calls, the packages, and the label rules live.
5. **Say what is synthetic.** The Sources page says what is curated, what is draft, and what real data this would run on, and the statement travels with every export.
6. **Never a recommendation.** The tool organizes and challenges; the scientist decides. No language that reads as promotion of pursuing or prescribing anything.
7. **The shard is the brand.** Geometry from the mood board, used with restraint.

## The 8px grid

Everything is built on an 8px grid, and consistency matters more than any single value.

- **Spacing** uses only the scale in `space.css`: 8, 16, 24, 32, 48, 64, 96. No 10px, no 12px, no 20px. If a composition needs something in between, change the composition, not the scale.
- **Sizes** snap to the grid: controls are 32, 40 or 48px tall, icons are 16 or 24px, touch targets are at least 48px, columns are 320 and 384px, the header is 56px.
- **Line heights** are multiples of 8 (16, 24, 32, 48) so stacked text lands back on the grid. Font sizes themselves do not need to be multiples of 8.
- **Vary spacing for hierarchy** within the scale: tight groupings at 8 and 16, generous separations at 32 and 48. Same spacing everywhere reads as monotone.
- **Use `gap`** for sibling spacing rather than margins, so values stay on the scale and never collapse unpredictably.
- **Half unit (4px)** is allowed only inside a control for optical alignment, such as a small radius or an icon nudge. It never appears between elements.

## Layout and motion

- Light theme. The mood board sets black on white; a scientist reads a reprint on paper, and the page should feel like one. No dark mode.
- One header on every page: 120px, the wordmark on a white block that hugs it, 40px to its left and 45px to its right (the way home; there is no search in the header), the shard band from the block's edge, so the header is identical on every page. One content column, 80px gutters, 1440px max (1184px on Appraise and Export); the ask box sits centred, both ways, in the space under the header. Minimum supported width 1280px.
- Minimal chrome: the sunken page, glass panels, generous whitespace, asymmetric compositions. Results are rows in a panel; the board's cards are the one place a card is allowed, and never a card inside a card.
- The chain reads left to right, drug to condition: nodes are sharp rectangles, each link between them is one claim with its own evidence and label. The link's 1px line repeats the label; the square and the word do the rest. Six nodes fit the column; more scroll sideways inside the chain.
- Controls are sharp, matching the shard geometry; surfaces are round (24px), and so are the radio dots and the two circles in the ask box.
- Motion only for state changes, on opacity, transform, and blur, 120 to 640 ms, ease-out curves. Nothing slides. A page arrives as one reveal: each block comes in the way the ask box does, at 103% and soft, fading in and settling to size with one small undershoot over 640ms (`.arrive`), staggered 40ms; so does the body of Detail when the evidence date changes, the results when a run completes, and the step aside as each step finishes. Rows inside a panel fade in, staggered. The running row's bar fills over the step's duration. A row expanding is a height change on the grid (`grid-template-rows`), never a slide. Changing the evidence date re-mounts the body as one reveal. Hover settles colour over 240ms; press scales to 0.98. Reduced motion collapses every duration through the tokens.
- The shard composes and decomposes plane by plane, 40ms apart, 240ms each: in from the topmost plane down to the ground, out from the ground up to the topmost. The ground is two pieces that sit a further 80ms apart, so it settles in two beats. Every instance of the mark arrives this way (`Shard` in `src/components/frame.tsx`; `--shard-fade`, `--shard-stagger`, `--shard-ground-gap`).
- Startup: the page opens on the hero from the mockup, the wordmark at 128px over a 280px white band with the shard below. The planes compose, the wordmark fades in, the hero holds for a second, the planes come apart, and the wordmark scales into its place in the header while the page fades in beneath; then the header band composes. About three seconds, once per page load; reduced motion skips it (`src/components/Splash.tsx`).
- Entry's arrival: under the startup screen the ask box waits. Once the screen has lifted and the header band has composed (its cascade, about 800ms), the box comes in the way a Spotlight window does: already there at 105% and soft (a 10px blur), fading in and settling to size with one small undershoot over 640ms, sharp by the time it stops (`ask-arrive` in `src/styles/screens.css`). Its shadow arrives with it on its own keyframes and keeps its blur. A later visit to Entry is the ordinary page reveal.

## Not this

Dark "AI lab" dashboards with cyan glow. Chat bubbles. Sparkle icons. Icons above every heading. Red, amber, green confidence lights. Bare percentage scores. Gradient text. Colored side stripes on cards. Glass on the controls (chips, segments, nodes, buttons stay solid and sharp). A disclaimer box where the counter-case should be. A tab or button that leads nowhere. A count of what a historical view hides. Anything that looks like a pitch deck or a press release.
