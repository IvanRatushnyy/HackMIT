# Restore the shard system under the new flow — design

20 September 2026. Approved in conversation; supersedes the visual sections of the 19 Sep frontend spec.
The 20 Sep paper-and-ink redesign kept its page structure and lost its material. This spec restores the
original design system (the shard, its plane-by-plane motion, Aujournuit and Supreme, the four-colour
palette) under the newer flow, and drops glass everywhere.

## What stays exactly as it is

Routes, data, the evidence-label rules, the stage model (ask → research → candidates → appraisal → share),
the ten-box pipeline on Working, the two registers with three-answer rows on Results, the facts strip and
page map on Detail, the pathway drawing (compartment bands, boxes, arrows whose weight and dash are the
evidence), the date scrubber, Sources, Export.

## Type — three faces, one job each

| Role | Face | Where |
|---|---|---|
| Wordmark | Aujournuit, Airy width (175%), lowercase | The header wordmark (48px) and the splash (128px). Nowhere else. |
| Titles | Poppins 800, lowercase, tracking −3.5% (600 for row names and register words) | Page titles, section heads, candidate names, pipeline questions, the display roles |
| Text | Supreme 400/500, tracking −4% | Everything else: body, rows, controls, kickers, the pathway's labels |

Aujournuit and Supreme return from commit `35968f2` into `design/fonts/`. Poppins is self-hosted (OFL) if it
can be fetched, otherwise loaded from Google Fonts. Lusitana and Instrument Sans are removed.

## Colour and material

Tokens stay on the current `colors.css` (white `#fbfcfe`, ink `#06070e`, slate, raspberry, dust, neutrals on
hue 276). The page is the sunken neutral. Every panel is solid white with a 1px dust line and sharp corners:
no blur, no blurred shadow, no glow. Controls are sharp. The only round things are the radio dots. The
pathway's SVG nodes keep their radii; its colours flow from the evidence tokens. The running pipeline box
carries a 2px ink border and a slate bar filling beneath it.

## Header — the shard as the stage indicator

120px on every page: the wordmark on its white block at left, the shard band from the block's edge across the
rest. No rail in the header. The band's coloured planes are grouped into five stage groups, left to right; the
dust pieces are the constant ground.

- Done → gone (the `vanish` fade, 240ms).
- Current → full colour, with a hairline of light along its edge and the label (`4 appraisal`, Supreme 13px
  medium) inside the plane at its top-right, right-aligned, white on ink/slate/raspberry, with a 4px halo in
  the plane's own colour.
- Ahead → present at 55% opacity.

Transitions animate both ways on route change and on a prop change within a route (Working → Results). A deep
link mounts in its final state. On first load the splash plays, then the band composes plane by plane straight
into its stage state, label last. The `Stages` rail component leaves the header; finished stages are no longer
header links (pages carry their own back links).

## Startup

`Splash.tsx`, `splash.ts` and `splash.test.ts` return from `35968f2`: planes compose topmost-first, the
Aujournuit wordmark fades in, holds, the planes come apart, the wordmark travels into the header while the page
fades in beneath, then the band composes. Re-enabled in `App.tsx`; reduced motion skips it. The
elution-column splash is removed.

## Entry

Hero: `prove it to me` and the paragraph, left column only; no illustration. The field full-width beneath with
the `1 ask` kicker, the ink `appraise →` button and the three example words. Under the field, the five-stage
rail (icons in sharp boxes, current in ink, the rest faint, hairlines between), a step larger than the old
header version. The four next-step boxes are removed. Title, field and rail arrive with the `arrive` motion,
40ms apart. Paste-a-paper stays out.

## Stylesheets

`base.css` is rewritten in one generation: reset, type roles, page frame, header and shard, paper panel, sharp
controls, evidence label, drivers, motion (including the shard keyframes). Each `<screen>.css` is collapsed:
glass-era rules that the appended 20 Sep blocks overrode are deleted, survivors use semantic tokens.
`ink.css` and `screens.old.css` are deleted; no `--ink`/`--paper`/`--hair` token survives in `src/styles`.

## Removals

`Ground.tsx` and `@paper-design/shaders-react`; `Molecule.tsx`; the dead `Ask.tsx` and `PastePaper.tsx`;
`ink.css`; `screens.old.css`; Lusitana and Instrument Sans. `motion/react` stays (pipeline, Detail, pathway).

## Verification

`npm test` (incl. the restored splash schedule test, the shard parser test and a new test for the plane-state
logic), `npx tsc -b`, `npm run build`, a grep for leftover ink-theme tokens, and real-time screenshots reviewed
before reporting: the header at all five stages, the Entry → Working handoff mid-fade, the splash mid-way,
Entry, Working mid-run, Results, Detail top and pathway, Sources, Export.

## Out of scope

Data, routing or label-rule changes; mobile; paste-a-paper; the raspberry working glow; the mesh gradient.

## Amendments during implementation (20 Sep, same day)

Decided in review of the running app; the sections above stand except where these say otherwise.

- **Type.** Poppins was dropped before it shipped. Supreme takes every role except the wordmark: Medium 500 for titles
  (lowercase, tracking −3%), Regular for text. The ladder is 96 / 40 / 28 / 20 / 16 / 14 / 12.
- **The band.** No plane is dimmed: the planes ahead stay in full colour, and the hairline of light on the current plane
  went with the dimming. A stage transition is slow: `--stage-fade` (1200ms, ease-in-out) for the plane leaving or
  returning, the label following it. The dust under the slate (plane 6) belongs to stage 1, so the band empties cleanly
  from the left. The header crop moved from offset 280 to 176 so that five planes cross the strip.
- **Grid pass.** Half-unit gaps between elements, 13px labels, the 18/28 reading size and 24px names were brought onto
  the scale; the `Stages` rail lost its link and done-state code, which nothing used once it left the header.
- **The band, again.** The stage indicator was withdrawn after review: the band is static, composing once when the
  startup screen lifts, at the original crop (offset 280), with no label. The five-stage rail moved to the top centre
  of every page, under the header, rendered by `Header`. `STAGE_PLANES`, `planeState` and their tests are gone.
- **Entry** became one centred stack under the flow: title, one sentence, the field, the examples. The `1 ask`
  kicker, the paragraph, the four next-step boxes and the illustration are all gone.
- **Text.** The flow is the only wayfinding, so the `2 research` / `3 candidates` / `4 appraisal` kickers and the
  sentence under every section title were removed; the Results sub line stays because it carries the count, the date
  and the link to Sources.
- **Icons.** Every hand-drawn SVG icon was replaced by Phosphor (`@phosphor-icons/react`): the stages, the pipeline
  steps and check, the arrows, the plus/minus row marks on Detail and Sources, the claim panel's close.
- **Type, again.** Satoshi (Fontshare, self-hosted) for titles, Bold, and for names, Medium, in sentence case; the
  lowercase rule now applies to the wordmark alone. Supreme stays for text.
- **Ask section.** The stack is centred in the space under the flow with equal air above and below, one gap (48px)
  between its blocks.
- **Type, final.** Satoshi withdrawn. Two faces: Aujournuit at the Regular width, lowercase, for the titles that
  matter most (the landing headline, page titles, the Detail name, section titles, the display numerals); Supreme
  for everything else, names and register words included. The wordmark stays at the Airy width.
