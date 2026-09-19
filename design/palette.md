# elute palette

Four brand colors. White and black carry the interface; slate is the one recurring highlight; dust and raspberry are secondary accents that stay rare.

| Name | Hex | RGB | OKLCH | Role | Visual weight |
|---|---|---|---|---|---|
| White | `#fbfcfe` | 251 252 254 | `oklch(99.0% 0.003 276)` | Page and panel surface | dominant |
| Black | `#06070e` | 6 7 14 | `oklch(13.1% 0.016 276)` | Ink, primary buttons, the dominant shard, "established" | dominant |
| Slate | `#47667d` | 71 102 125 | `oklch(49.6% 0.052 241)` | Main highlight: selection, links, active controls, "contested" | the 10% |
| Dust grey | `#d3d3d3` | 211 211 211 | `oklch(86.7% 0.004 276)` | Dividers, inactive shards, disabled, links outside the active filter | secondary |
| Raspberry | `#82204a` | 130 32 74 | `oklch(41.5% 0.137 359)` | "Single-source", the safety flag, destructive actions | rare |

The original export listed pure white as the surface. The tokens use `#fbfcfe`, white tinted toward the ink hue, so surfaces and ink share a cast. Dust grey is likewise nudged toward hue 276 in the tokens; the brand hex stays `#d3d3d3` for print and mood boards.

## Evidence labels

Every link in a mechanism chain, and every claim in a counter-case, carries one of four labels.

| Label | Color | Also conveyed by |
|---|---|---|
| Established | Ink | The word "established", a solid link |
| Contested | Slate | The word "contested", a dashed link, both sides shown |
| Single-source | Raspberry | The word "single-source" with its qualifier (n, blinding, replication), a dashed link |
| Unknown | Neutral 500 | The word "unknown", a dotted link, one sentence on what is missing |

Never convey a label by color alone. A label is never bare: the source, or the heuristic that produced it, is one click away.

The safety flag is a raspberry word with its reason next to it, never a banner. Confidence is a figure in ink that opens its drivers, never a color scale or a bar.

## Contrast on the white surface

| Pair | Ratio | Use |
|---|---|---|
| Black on white | 19.6 : 1 | Any text |
| Raspberry on white | 9.1 : 1 | Any text |
| Slate on white | 5.9 : 1 | Any text, links, white text on slate buttons |
| Neutral 600 on white | 5.4 : 1 | Muted body text |
| Neutral 500 on white | 3.8 : 1 | Large text and icons only |
| Dust on white | 1.5 : 1 | Lines and fills only |

## Rules

- No pure `#000` or `#fff` anywhere.
- No gradients. The export's gradient presets are intentionally unused.
- No gradient text, no glow, no colored side stripes.
- If more than a few pixels of raspberry are on screen, the candidate is genuinely weak, and that is exactly what the page should say.
