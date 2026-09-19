# Glass layer

couloir uses [liquid-glass-js](https://github.com/dashersw/liquid-glass-js) for the few controls that float over the map. Design rules live in `DESIGN.md` under "Glass". This file is the wiring.

## What is here

| Path | Purpose |
|---|---|
| `vendor/` | The library, unmodified, pinned to one commit. See `vendor/VERSION`. |
| `glass-theme.css` | Brand overrides: 8px grid, Supreme labels, quiet shadow, fallbacks. |
| `glass.config.js` | The `window.glassControls` preset. Load before the first instance. |
| `liquid-glass.d.ts` | Ambient TypeScript types for the `Container` and `Button` globals. |

## How the library works

It takes one `html2canvas` snapshot of `document.body` when the first `Container` is created, uploads it to WebGL, and each glass element refracts and blurs the part of the snapshot behind it. Scrolling is tracked. Resizing, map panning, and any DOM change after the snapshot are not.

Consequences:

- **The map must be capturable.** Create the MapLibre map with `preserveDrawingBuffer: true`, otherwise the snapshot sees an empty canvas.
- **Re-capture after the background changes.** On the map's `moveend` (debounced, about 300 ms) set `Container.pageSnapshot = null`, call `capturePageSnapshot()` on one instance, and rebuild the affected glass elements. A snapshot costs tens to hundreds of milliseconds, so keep glass elements few and small.
- **Set the preset before construction.** The library reads `window.glassControls` with `||` fallbacks; a `0` becomes the default. Use `0.001` for "off".
- **It needs WebGL 1** (`getContext('webgl')`). Without it, or under `prefers-reduced-transparency`, `glass-theme.css` swaps in a solid surface with `backdrop-filter`.

## Loading in a Vite + React app

Install the one runtime dependency at the app root:

```sh
npm install html2canvas@1.4.1
```

The vendored files are classic scripts that define top-level classes, so load them from `index.html`. Copy or symlink `design/glass` into the app's `public/` directory, or serve `design/` from the app's Vite config with `server.fs.allow` and `publicDir`.

```html
<!-- index.html -->
<link rel="stylesheet" href="/glass/vendor/glass.css" />
<link rel="stylesheet" href="/glass/glass-theme.css" />
<script src="/glass/glass.config.js"></script>
<script src="/glass/vendor/container.js"></script>
<script src="/glass/vendor/button.js"></script>
```

```ts
// main.tsx, before any glass element is created
import html2canvas from 'html2canvas'
window.html2canvas = html2canvas
```

```ts
// A horizon toggle: one pill container, three pill buttons
const horizon = new Container({ type: 'pill', tintOpacity: 0.35 })
for (const label of ['24 h', '72 h', '7 d']) {
  const b = horizon.addChild(new Button({ text: label, size: 14, type: 'pill', onClick: setHorizon }))
  b.element.setAttribute('role', 'radio')
}
mapOverlay.appendChild(horizon.element)
```

Add `design/glass/liquid-glass.d.ts` to the app's `tsconfig.json` `include` so `Container` and `Button` type-check.

## Fallback detection

```ts
const canvas = document.createElement('canvas')
const hasWebGL = !!canvas.getContext('webgl')
const lessTransparency = matchMedia('(prefers-reduced-transparency: reduce)').matches
if (!hasWebGL || lessTransparency) document.documentElement.classList.add('glass-fallback')
```
