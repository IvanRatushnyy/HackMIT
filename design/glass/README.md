# Glass layer

elute keeps [liquid-glass-js](https://github.com/dashersw/liquid-glass-js) vendored for a control that floats over something being read, such as a filter pill over the mechanism chain. Nothing loads it in v1: the ask box on Entry is glass in the stylesheet's own terms (`.ask` in `src/styles/base.css`), for the reasons under "How the library works" below. Design rules live in `DESIGN.md` under "Glass". This file is the wiring.

## What is here

| Path | Purpose |
|---|---|
| `vendor/` | The library, unmodified, pinned to one commit. See `vendor/VERSION`. |
| `glass-theme.css` | Brand overrides: 8px grid, Supreme labels, quiet shadow, fallbacks. |
| `glass.config.js` | The `window.glassControls` preset. Load before the first instance. |
| `liquid-glass.d.ts` | Ambient TypeScript types for the `Container` and `Button` globals. |

## How the library works

It takes one `html2canvas` snapshot of `document.body` when the first `Container` is created, uploads it to WebGL, and each glass element refracts and blurs the part of the snapshot behind it. Scrolling is tracked. Resizing, panning or zooming the chain, a link expanding, and any other DOM change after the snapshot are not.

Consequences:

- **The background must be capturable.** The shard hero as inline SVG and a chain built from SVG or DOM elements are captured directly. If the chain is drawn on a canvas, create it with `preserveDrawingBuffer: true`, otherwise the snapshot sees an empty canvas.
- **Re-capture after the background changes.** When the chain settles (debounced, about 300 ms after a pan, zoom, or a link expanding) set `Container.pageSnapshot = null`, call `capturePageSnapshot()` on one instance, and rebuild the affected glass elements. A snapshot costs tens to hundreds of milliseconds, so keep glass elements few and small.
- **Set the preset before construction.** The library reads `window.glassControls` with `||` fallbacks; a `0` becomes the default. Use `0.001` for "off".
- **It needs WebGL 1** (`getContext('webgl')`). Without it, or under `prefers-reduced-transparency`, `glass-theme.css` swaps in a solid surface with `backdrop-filter`.
- **The snapshot is a fresh clone of the DOM**, so a CSS animation that is running at capture starts over from its first frame in the clone: anything mid-arrival with `animation-fill-mode: both` is read as absent. Capture once the page is holding still, or freeze the clone in html2canvas's `onclone`.
- **It draws at 1×.** The canvas is sized in CSS pixels, so on a 2× display the refraction and the shape's edge are soft. A control that needs a crisp edge on a flat surface is better served by the stylesheet's own glass (the ask box on Entry: `.ask` in `src/styles/base.css`).

## Loading in a Vite + React app

Install the one runtime dependency at the app root. It has to be `html2canvas-pro`, the maintained fork: every colour in `design/tokens` is `oklch()`, which html2canvas 1.4.1 cannot parse (the snapshot throws, and no glass ever initialises).

```sh
npm install html2canvas-pro
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
import html2canvas from 'html2canvas-pro'
window.html2canvas = html2canvas
```

```ts
// The chain's label filter: one pill container, three pill buttons
const filter = new Container({ type: 'pill', tintOpacity: 0.35 })
for (const label of ['All', 'Contested', 'Single-source']) {
  const b = filter.addChild(new Button({ text: label, size: 14, type: 'pill', onClick: setFilter }))
  b.element.setAttribute('role', 'radio')
}
chainOverlay.appendChild(filter.element)
```

The entry choices are the same shape: one pill container over the shard hero with two pill buttons, *Start from a condition* and *Start from a drug*.

Add `design/glass/liquid-glass.d.ts` to the app's `tsconfig.json` `include` so `Container` and `Button` type-check.

## Fallback detection

```ts
const canvas = document.createElement('canvas')
const hasWebGL = !!canvas.getContext('webgl')
const lessTransparency = matchMedia('(prefers-reduced-transparency: reduce)').matches
if (!hasWebGL || lessTransparency) document.documentElement.classList.add('glass-fallback')
```
