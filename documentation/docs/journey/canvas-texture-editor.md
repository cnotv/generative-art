---
sidebar_position: 15
---

# Canvas Texture Editor

## Goal

Build a reusable in-browser canvas drawing tool that lets users paint front/back character textures and share them across a P2P multiplayer session.

## Component architecture

The editor was split into focused, single-responsibility pieces:

```
src/components/CanvasEditor/
  CanvasEditor.vue          ← public entry point, owns undo/redo keyboard shortcuts
  CanvasEditorCanvas.vue    ← single drawing canvas, exposes snapshot/restore API
  CanvasEditorTools.vue     ← toolbar: tool buttons, color picker, BrushSize, save group
  BrushSize.vue             ← split-button dropdown for brush size slider + numeric input
  useCanvasEditor.ts        ← drawing + history composable (no Vue dependency)
```

**Rule applied:** complex interactive UI → dedicated component + sub-components per responsibility + co-located composable for stateful logic.

## Undo / redo with immutable history

Undo/redo is implemented as a pure immutable stack in `packages/canvas-editor/src/history.ts`. Each action snapshots the canvas as a `toDataURL()` string and stores it in `{ past: string[], future: string[] }`. No mutations — every operation returns a new stack object.

This makes the history trivially testable without a browser.

## Canvas global style conflict

`App.vue` declares a global rule:

```css
canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}
```

This is intended for full-screen Three.js canvases. The editor canvas overrides it with:

```css
.canvas-editor-canvas__canvas {
  position: static;
  width: 100%;
  height: auto;
}
```

Scoped styles win because Vue adds a `data-v-*` attribute selector, giving them higher specificity than the bare `canvas` element rule.

## SVG circle cursor

For brush and eraser tools, the native crosshair cursor is replaced by an SVG overlay:

- An `<svg>` sits `position: absolute; inset: 0; pointer-events: none` over the canvas wrapper so it doesn't block drawing events.
- Mouse position is tracked in display-pixel space and the circle radius is `(brushSize / 2) * (displayWidth / canvasWidth)` to correctly scale from logical canvas coords to CSS pixels.
- The cursor is hidden on the canvas with `cursor: none` only when the overlay is active.

## BrushSize split-button

The brush size control is a compact split button:

- Left side shows the current size (e.g. `4 px`) and triggers quick save.
- Right arrow opens a dropdown with a Radix `Slider` and an inline number `<input>` styled like the config panel inputs — transparent background, no spinner arrows, fixed `3.5em` width.

This matches the project's panel input style while keeping the toolbar compact.

## Storage backends

Two backends are supported, selectable from the save dropdown:

| Backend        | API   | Notes                                          |
| -------------- | ----- | ---------------------------------------------- |
| `localStorage` | sync  | Simple key/value, survives page reload         |
| `IndexedDB`    | async | Larger capacity, async API wrapped in Promises |

The unified API (`storageSave`, `storageLoad`, `storageDelete`, `storageList`) returns `Promise<T> | T` and callers use `await Promise.resolve(result)` to handle both.

## Download

The download action creates a temporary `<a>` element, sets `href` to the canvas `toDataURL()`, and programmatically clicks it. No server round-trip needed.

## Navigation bar clearance

All views must apply `padding-top: var(--nav-height)` (or equivalent) to prevent the fixed navigation bar from obscuring content. The canvas editor view uses:

```css
.canvas-texture-editor {
  height: calc(100vh - var(--nav-height));
  padding-top: calc(var(--nav-height) + var(--spacing-4));
}
```

This was codified as a rule in `.github/rules/code-style.md`.

## Testing approach

Unit tests in jsdom mock the `CanvasRenderingContext2D` with a plain object using `vi.fn()` because jsdom does not implement the Canvas 2D API. Tests verify:

- Correct `globalCompositeOperation` for brush vs eraser
- Correct property assignment (`strokeStyle`, `lineWidth`, `fillStyle`)
- Correct method calls (`beginPath`, `stroke`, `arc`, `fill`, `clearRect`)

`drawingFill` is partially tested — the pixel-walking logic works but `hexToRgb` requires a real browser canvas to parse color strings. That path is covered by the browser test suite.

## P2P texture integration (PR #76)

The editor was integrated into `MultiplayerP2P.vue` to paint live on a shared 3D character texture:

- `CanvasEditor.vue` exposes `snapshot()` via `defineExpose` so the parent can read the current `HTMLCanvasElement` without reaching into child internals.
- `buildAndApplyTexture(front, back)` was extracted in the multiplayer view so the same code path runs on both **local draw** (direct canvas update) and **remote peer texture** (receive + apply) — no duplicated ordering logic.
- A floating `Paintbrush` toggle opens/closes the editor panel instead of embedding it in the HUD, keeping the 3D viewport unobstructed during play.
- On mount, `storageLoad(SLOT_NAME)` restores the last saved texture synchronously before any draw, so the remote peer always sees the final texture rather than a blank intermediate.
- The same `P2P_TEXTURE_CHANNEL` used for static textures carries editor output — no new channel needed, the broadcast function just fires whenever the canvas changes.

### Pitfalls encountered in the integration

- **Rebuild `packages/*/dist`** — `@webgamekit/canvas-editor` is consumed via its `dist/`. Edits to `src/` inside the package don't reach the host app until `pnpm build` runs in the package directory. Several "why isn't this change showing up" moments traced back to stale `dist/`.
- **Silent restore flag** — restoring the saved slot on mount must not broadcast, or peers receive a flurry of old-texture events on every page load. A `silent` flag on the restore path is cheaper than trying to gate at the broadcast layer.
- **Cover-fit, not contain** — the front/back canvas halves use `object-fit: cover` when composited into the character texture; contain leaves unused transparent margins that bleed into UV-adjacent faces.
- **Canvas aspect must match source** — loading a saved slot whose aspect ratio differs from the current canvas stretches the image. The editor canvas dimensions are now fixed to match the source texture dimensions.
- **Vue `:key` on side toggle** — switching front/back without a `:key` lets Vue reuse the canvas node, which carries the previous side's bitmap into the new side. A `:key="side"` forces a fresh mount and a clean canvas.
- **BrushSize dropdown clamping** — the slider `max` and numeric input need to clamp to the same bounds; mismatched bounds let users type values the slider can't represent.
