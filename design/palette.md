# couloir palette

Four brand colors. White and black carry the interface; slate is the one recurring highlight; dust and raspberry are secondary accents that stay rare.

| Name | Hex | RGB | OKLCH | Role | Visual weight |
|---|---|---|---|---|---|
| White | `#fbfcfe` | 251 252 254 | `oklch(99.0% 0.003 276)` | Page and panel surface | dominant |
| Black | `#06070e` | 6 7 14 | `oklch(13.1% 0.016 276)` | Ink, primary buttons, the dominant shard | dominant |
| Slate | `#47667d` | 71 102 125 | `oklch(49.6% 0.052 241)` | Main highlight: selection, links, active controls, "watch" | the 10% |
| Dust grey | `#d3d3d3` | 211 211 211 | `oklch(86.7% 0.004 276)` | Dividers, inactive shards, disabled, "stable" | secondary |
| Raspberry | `#82204a` | 130 32 74 | `oklch(41.5% 0.137 359)` | Highest severity only, destructive actions | rare |

The original export listed pure white as the surface. The tokens use `#fbfcfe`, white tinted toward the ink hue, so surfaces and ink share a cast. Dust grey is likewise nudged toward hue 276 in the tokens; the brand hex stays `#d3d3d3` for print and mood boards.

## Severity mapping

| Severity | Color | Also conveyed by |
|---|---|---|
| Warning | Raspberry | Position (pinned to top), size of the lead-time figure, the word "Warning" |
| Watch | Slate | The word "Watch", a filled marker |
| Stable | Dust grey | An outlined marker, no figure |
| No data | Neutral 500 | A dashed marker, the age of the last satellite pass |

Never convey severity by color alone.

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
- If more than a few pixels of raspberry are on screen, something is genuinely wrong.
