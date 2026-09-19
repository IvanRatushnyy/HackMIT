# couloir — design

**couloir** is a disaster-response tool for glacial hazard prediction: glacial lake outburst floods, glacier collapse, and ice-dammed lake drainage. A custom backend scores monitored sites and forecasts outburst windows. The frontend turns those forecasts into decisions for the people who have to act on them.

A couloir is a steep, narrow gully in mountainous terrain, often filled with snow or ice.

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
    │   ├── glass.config.js   the couloir glass preset (window.glassControls)
    │   ├── liquid-glass.d.ts ambient types for the library's globals
    │   └── vendor/           liquid-glass-js, unmodified, pinned commit, MIT
    ├── fonts/
    │   ├── Aujournuit-VariableVF.ttf   display, width axis 50–200
    │   ├── Supreme-Variable.ttf        text, weight axis 100–800
    │   ├── Supreme-VariableItalic.ttf  text italic, weight axis 100–800
    │   └── fonts.css                   @font-face and metric-matched fallbacks
    └── tokens/
        ├── index.css         imports everything below, in order
        ├── colors.css        primitives, neutral ramp, semantic and severity tokens
        ├── space.css         8px grid: spacing, sizes, layout, shape, motion
        └── typography.css    families, tracking, weights, type scale, text roles
```

In a Vite or React app, import `design/tokens/index.css` once from the entry file and use the semantic tokens and classes everywhere else.

## Who it is for

- **Emergency management officers** watching the board routinely for weeks, then acting under pressure for hours. Desktop and ops-room displays, day and night.
- **Glaciologists and hydrologists** validating forecasts. They distrust black-box numbers and want the evidence behind a score.
- **Field coordinators** checking one site on a phone with poor connectivity. They need the answer in one glance.

Job to be done: know which sites are moving toward failure, how much lead time remains, and who is downstream, early enough to evacuate. The interface must serve calm monitoring and acute crisis without switching modes.

## Personality

**Quiet, exact, steep.** Confidence under pressure. A well-kept instrument, not an alarm panel. Severity is communicated by contrast and placement, never by flashing, glow, or noise.

## Typography

| Role | Face | Setting | Use |
|---|---|---|---|
| Display | Aujournuit | Airy width (`font-stretch: 175%`), tracking −2%, weight 400 | Wordmark, page titles, a site name as a heading, empty-state headlines |
| Text | Supreme | Tracking −4%, Regular 400 | Body, labels, tables, controls: everything that is not a big title |
| Emphasis | Supreme | Medium 500 | Interactive labels, the current item |
| Headline figure | Supreme | Bold 700 | Only the one number that must be read first, such as lead time |
| Annotation | Supreme Italic | Regular 400 | Model caveats, analyst notes |

Scale for product UI is fixed in rem, ratio about 1.25, and every size pairs with a line height on the 8px grid:

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-xs` | 12px | 16px | Captions, timestamps |
| `--text-sm` | 14px | 24px | Secondary UI, metadata |
| `--text-md` | 16px | 24px | Body |
| `--text-lg` | 20px | 32px | Section headings |
| `--text-xl` | 28px | 32px | Key figures |
| `--text-2xl` | 40px | 48px | The headline number |

Aujournuit titles on landing surfaces use the fluid `--display-md` and `--display-lg` sizes at line height 1, with margins that return the block to the grid. Body measure caps at 65ch.

Notes from the font files:

- Aujournuit has one weight and five named widths: Condensed 50, Densed 75, Regular 100, Airy 175, Wide 200. Only Airy is used.
- Aujournuit supports `ss01`, `dlig`, `frac`, `ordn` and `sups`. Supreme supports `salt`, `frac`, `ordn` and `sups`.
- Neither face has tabular figures. Columns of numbers are right-aligned with the `.figure` class rather than relying on equal digit widths.
- Fallback faces in `fonts.css` carry the real fonts' ascent and descent so text does not jump on load.

## Color

Read `design/palette.md` for the full table. In short:

1. **White** `#fbfcfe` is the page. Tinted toward the ink hue, never pure.
2. **Black** `#06070e` is the ink, primary buttons, and the dominant shard.
3. **Slate** `#47667d` is the main highlight and the only recurring color: selection, links, active controls, the Watch severity.
4. **Dust grey** `#d3d3d3` is a secondary accent for dividers, inactive shards, disabled states, the Stable severity.
5. **Raspberry** `#82204a` is a secondary accent that stays rare: the Warning severity and destructive actions.

All neutrals are tinted toward hue 276, the black's hue, at chroma 0.003 to 0.016. Contrast is verified against the white surface: black 19.6:1, raspberry 9.1:1, slate 5.9:1, muted text 5.4:1.

## The shard

The one unforgettable element is the composition from the mood board: large intersecting curved planes in black, slate, raspberry, and dust, evoking a couloir cut through a mountainside. It is the brand mark, the hero graphic, and, sparingly, an abstract terrain element behind a site header. It is never placed behind body text and it is the only decoration allowed.

## Glass

Glassmorphism is used in one place and for one reason: controls that float over the map must not hide the terrain beneath them. The map is the evidence, and a solid panel over it would cover the very thing the officer is reading. The effect comes from [liquid-glass-js](https://github.com/dashersw/liquid-glass-js), a WebGL refraction library vendored in `design/glass/vendor`, with the couloir preset in `design/glass/glass.config.js` and brand overrides in `design/glass/glass-theme.css`. Wiring and constraints are in `design/glass/README.md`.

Where glass appears:

- The horizon toggle (24 h, 72 h, 7 d) as one pill container with pill buttons.
- The map control cluster (zoom, locate, layers) as circle buttons.
- The handle and header of the phone bottom sheet, so the map stays visible while the sheet is collapsed.

Where glass never appears: the site index, the detail rail, banners, tables, or any surface whose job is reading. Glass is a control material, not a panel material. At most three glass containers on screen at once, nested one level deep at most.

Rules:

- **Readable first.** Labels on glass are ink on a light tint. Keep `tintOpacity` at 0.3 or above so ink stays at 4.5:1 or better over the darkest part of the basemap.
- **Quiet optics.** Low ripple, low centre distortion, soft blur. The refraction should be noticed on the second look, not the first. The preset in `glass.config.js` is the starting point; tune it over the real map.
- **Grid holds.** Glass containers use 8px padding and gap; buttons are 40 or 48px tall. Pills and circles are the one place corners are round: solid surfaces are sharp like the shard, floating controls are soft like ice.
- **Same states as everything else.** Hover lifts by 1px, press scales to 0.98, focus shows the slate ring. Transform and opacity only.
- **Degrade honestly.** No WebGL or `prefers-reduced-transparency` gives a solid white surface with a 1px line and a light backdrop blur, same markup, same size.
- **Know the cost.** The library snapshots the page once; the map must be created with `preserveDrawingBuffer` and the snapshot refreshed after the map settles. Few, small glass elements.

## Principles

1. **Lead time is the headline.** Every site view answers "how long do we have?" before anything else.
2. **Severity by weight, not decoration.** Size, position, and the rare use of raspberry carry urgency. No blinking, glow, or icons as alarms.
3. **Show the evidence.** A score is always one click from the signals that produced it.
4. **Quiet by default.** Most of the time nothing is happening, so the board should look calm and empty of urgency, which makes urgency unmistakable when it appears.
5. **The shard is the brand.** Geometry from the mood board, used with restraint.

## The 8px grid

Everything is built on an 8px grid, and consistency matters more than any single value.

- **Spacing** uses only the scale in `space.css`: 8, 16, 24, 32, 48, 64, 96. No 10px, no 12px, no 20px. If a composition needs something in between, change the composition, not the scale.
- **Sizes** snap to the grid: controls are 32, 40 or 48px tall, icons are 16 or 24px, touch targets are at least 48px, columns are 320 and 384px, the header is 56px.
- **Line heights** are multiples of 8 (16, 24, 32, 48) so stacked text lands back on the grid. Font sizes themselves do not need to be multiples of 8.
- **Vary spacing for hierarchy** within the scale: tight groupings at 8 and 16, generous separations at 32 and 48. Same spacing everywhere reads as monotone.
- **Use `gap`** for sibling spacing rather than margins, so values stay on the scale and never collapse unpredictably.
- **Half unit (4px)** is allowed only inside a control for optical alignment, such as a small radius or an icon nudge. It never appears between elements.

## Layout and motion

- Light theme. The mood board sets black on white; night use is handled with lower-contrast greys, not a dark mode.
- Minimal chrome: white surfaces, few 1px lines, generous whitespace, asymmetric compositions. No card grids, no cards inside cards.
- Corners are sharp by default, matching the shard geometry. Round only markers and pills.
- Motion only for state changes, on transform and opacity, 120 to 400 ms, ease-out curves. Reduced motion respected.
- Adapt for phones rather than shrink: the field coordinator's single-glance answer comes first.

## Not this

Dark "mission control" dashboards with cyan glow. Icons above every heading. Red, amber, green traffic lights. Gradient text. Colored side stripes on cards. Glass on reading surfaces or glass everywhere. Anything that looks like a weather app.
