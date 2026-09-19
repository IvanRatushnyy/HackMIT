# elute — design

**elute** is a drug-repurposing decision tool, built for the Regeneron challenge at HackMIT 2026. Given a condition or an approved drug, a backend ranks repurposing candidates. The frontend does the part no ranking tool does: it puts the strongest case *against* each candidate on screen first, labels every link in the mechanism chain as established, contested, single-source, or unknown, and never pretends to be more certain than it is. It organizes evidence for a scientist who is qualified to weigh it. It never recommends.

To elute is to wash a mixture through a column so that its compounds come out one at a time, separated. The tool does the same to a hypothesis: what is known comes apart from what is merely believed.

## Files

```
HackMIT/
├── DESIGN.md                 this document
├── .impeccable.md            design context for AI design tooling
├── package.json              shared front-end dependencies (html2canvas for the glass layer)
└── design/
    ├── palette.md            the four colors, roles, contrast, rules
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

In a Vite or React app, import `design/tokens/index.css` once from the entry file and use the semantic tokens and classes everywhere else.

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
| Entry | "I understand what this does in five seconds." | One Aujournuit sentence over the shard hero, then two glass pill choices: *Start from a condition* / *Start from a drug*. Nothing else. |
| Waiting | "It's doing real work, not stalling." | Named steps appear as they happen, in Supreme, one line each: *pulling targets · tracing pathways · checking literature · stress-testing*. No spinner, no progress bar. |
| Results | "I can triage this in fifteen seconds." | A ranked list of rows separated by 1px lines, not a card grid. Each row: the candidate in Medium, a one-line plain-language why, a confidence figure that opens its drivers, a safety flag as a word with its reason. Why #1 is above #2 is a sentence, not a bar. |
| Detail | "I can defend or kill this myself." | Counter-case first, above the fold, under the heading *Assume this is wrong. Here's the strongest case against it.* Each argument dated and sourced. Below it, the walkable mechanism chain with an evidence label on every link. Then safety as a reason with its evidence. Then the closing question: *Worth a trial? What would kill it?* |
| Depth | "As deep as I want, never forced." | A *Show the agent's work* toggle, off by default. Raw tool calls, sources, and dependencies in a plain panel set in the system monospace. |
| Exit | "I can take this with me." | Export as a document in the same type system: argument, counter-case, caveats, and the data note, intact and in that order. |

A data banner sits on every screen: one plain sentence in muted ink on the sunken surface, saying which parts are curated or synthetic and what real data the tool would run on. Not raspberry, not glass, not dismissible.

## Typography

| Role | Face | Setting | Use |
|---|---|---|---|
| Display | Aujournuit | Airy width (`font-stretch: 175%`), tracking −2%, weight 400 | Wordmark, page titles, a drug or condition name as a heading, the counter-case heading |
| Text | Supreme | Tracking −4%, Regular 400 | Body, labels, tables, controls, the chain: everything that is not a big title |
| Emphasis | Supreme | Medium 500 | Interactive labels, the current item, a candidate's name in the results, the evidence-label word |
| Headline figure | Supreme | Bold 700 | Only the one figure that carries an argument, such as *n = 12* or *0.53%* |
| Annotation | Supreme Italic | Regular 400 | Dates and sources under a claim, the data banner, caveats |
| Raw | System monospace | Regular | The agent's-work panel only. There is no brand mono; the system's is honest enough for tool calls. |

Scale for product UI is fixed in rem, ratio about 1.25, and every size pairs with a line height on the 8px grid:

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-xs` | 12px | 16px | Captions, dates, source lines |
| `--text-sm` | 14px | 24px | Secondary UI, metadata, evidence labels |
| `--text-md` | 16px | 24px | Body |
| `--text-lg` | 20px | 32px | Section headings |
| `--text-xl` | 28px | 32px | Key figures, the confidence figure |
| `--text-2xl` | 40px | 48px | The headline figure |

Aujournuit titles on landing surfaces use the fluid `--display-md` and `--display-lg` sizes at line height 1, with margins that return the block to the grid. Body measure caps at 65ch.

Notes from the font files:

- Aujournuit has one weight and five named widths: Condensed 50, Densed 75, Regular 100, Airy 175, Wide 200. Only Airy is used.
- Aujournuit supports `ss01`, `dlig`, `frac`, `ordn` and `sups`. Supreme supports `salt`, `frac`, `ordn` and `sups`.
- Neither face has tabular figures. Columns of numbers are right-aligned with the `.figure` class rather than relying on equal digit widths.
- Fallback faces in `fonts.css` carry the real fonts' ascent and descent so text does not jump on load.

## Color

Read `design/palette.md` for the full table. In short:

1. **White** `#fbfcfe` is the page. Tinted toward the ink hue, never pure.
2. **Black** `#06070e` is the ink, primary buttons, the dominant shard, and the *established* label.
3. **Slate** `#47667d` is the main highlight and the only recurring color: selection, links, active controls, the *contested* label.
4. **Dust grey** `#d3d3d3` is a secondary accent for dividers, inactive shards, disabled states, and chain links outside the active filter.
5. **Raspberry** `#82204a` is a secondary accent that stays rare: the *single-source* label, the safety flag, and destructive actions.

All neutrals are tinted toward hue 276, the black's hue, at chroma 0.003 to 0.016. Contrast is verified against the white surface: black 19.6:1, raspberry 9.1:1, slate 5.9:1, muted text 5.4:1.

Evidence labels are never color alone: every link carries its word, and *single-source* carries its qualifier (n, blinding, replication). Confidence is a figure in ink that opens its drivers, never a color scale or a bar.

## The shard

The one unforgettable element is the composition from the mood board: large intersecting curved planes in black, slate, raspberry, and dust, a mixture coming apart into bands the way compounds separate as they elute. It is the brand mark, the hero behind the entry sentence, and, sparingly, an abstract element behind a candidate header. It is never placed behind body text or the counter-case, and it is the only decoration allowed.

## Glass

Glassmorphism is used in two places and for one reason: a control that floats over something being read must not hide it. On Entry the two choices float over the shard hero, the one time glass meets the brand mark. On Detail the chain controls float over the walkable mechanism chain: the chain is the evidence, and a solid panel over it would cover the very link being judged. The effect comes from [liquid-glass-js](https://github.com/dashersw/liquid-glass-js), a WebGL refraction library vendored in `design/glass/vendor`, with the elute preset in `design/glass/glass.config.js` and brand overrides in `design/glass/glass-theme.css`. Wiring and constraints are in `design/glass/README.md`.

Where glass appears:

- The two entry choices (*Start from a condition* / *Start from a drug*) as one pill container with two pill buttons over the shard hero.
- The chain controls: the label filter (All, Contested, Single-source) as a pill container, and fit and zoom as circle buttons.
- The handle and header of the narrow-screen bottom sheet, so the chain stays visible while the sheet is collapsed.

Where glass never appears: the counter-case, the results list, link and source detail, the data banner, the agent's-work panel, the export, or any surface whose job is reading. Glass is a control material, not a panel material. At most three glass containers on screen at once, nested one level deep at most.

Rules:

- **Readable first.** Labels on glass are ink on a light tint. Keep `tintOpacity` at 0.3 or above so ink stays at 4.5:1 or better over the darkest part of the shard or the chain.
- **Quiet optics.** Low ripple, low centre distortion, soft blur. The refraction should be noticed on the second look, not the first. The preset in `glass.config.js` is the starting point; tune it over the real shard and chain.
- **Grid holds.** Glass containers use 8px padding and gap; buttons are 40 or 48px tall. Pills and circles are the one place corners are round: solid surfaces are sharp like the shard, floating controls are soft.
- **Same states as everything else.** Hover lifts by 1px, press scales to 0.98, focus shows the slate ring. Transform and opacity only.
- **Degrade honestly.** No WebGL or `prefers-reduced-transparency` gives a solid white surface with a 1px line and a light backdrop blur, same markup, same size.
- **Know the cost.** The library snapshots the page once. If the chain is drawn on a canvas it must be created with `preserveDrawingBuffer`, and the snapshot refreshed after the chain settles (pan, zoom, a link expanding). An SVG or DOM chain is captured directly. Few, small glass elements.

## Principles

1. **The counter-case is the headline.** Every Detail view answers "what would kill this?" before anything else, and answers it as the most polished block on the page.
2. **Known vs. believed, labeled on every claim.** Established, contested, single-source, or unknown, on every link, always with its word and its source. *Unknown* is a valid and valuable label. Never a bare number: confidence is always one click from its drivers.
3. **Doubt reads as rigor.** Emphasis by weight and placement; the rare use of raspberry marks the weakest link and the safety flag. No alarm styling, no disclaimer boxes.
4. **Show the work, never force it.** Sources one click away; the agent's raw work behind a toggle that is off by default.
5. **Say what is synthetic.** The data banner is on every screen and says what real data this would run on.
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
- Minimal chrome: white surfaces, few 1px lines, generous whitespace, asymmetric compositions. Ranked results are rows, not cards. No card grids, no cards inside cards.
- The chain reads left to right, drug to condition, on the grid: nodes are sharp-cornered rectangles, links are 1px lines whose style repeats the label (solid for established, dashed for contested and single-source, dotted for unknown). The word and the color do the rest.
- Corners are sharp by default, matching the shard geometry. Round only pills and the glass circle buttons.
- Motion only for state changes, on transform and opacity, 120 to 400 ms, ease-out curves. Waiting steps rise and fade in one after another and stay. A link expanding is a height change on the grid, not a slide. Reduced motion respected.
- Adapt for narrow screens rather than shrink: the counter-case comes first at every width; the chain scrolls horizontally under a bottom sheet.

## Not this

Dark "AI lab" dashboards with cyan glow. Chat bubbles. Sparkle icons. Icons above every heading. Red, amber, green confidence lights. Bare percentage scores. Gradient text. Colored side stripes on cards. Glass on reading surfaces or glass everywhere. A disclaimer box where the counter-case should be. Anything that looks like a pitch deck or a press release.
