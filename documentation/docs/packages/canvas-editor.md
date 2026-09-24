---
sidebar_position: 13
---

# Package: @webgamekit/canvas-editor

The drawing half of a 2D canvas editor: stroke and fill operations, an undo stack,
persistence, and helpers for turning the result into a texture. It owns no UI and no canvas
— the caller supplies a `CanvasRenderingContext2D`, which is what lets the same functions
back a drawing game, a texture painter and an avatar editor.

![The canvas editor in use, with its brush, fill, colour, undo and export controls](/img/canvas-editor/painted.webp)

## Installation

```bash
pnpm add @webgamekit/canvas-editor
```

Browser only: it uses `CanvasRenderingContext2D`, `localStorage` and `indexedDB`.

## Drawing

```typescript
import { drawingStroke, drawingDot, drawingFill, drawingClear } from '@webgamekit/canvas-editor'

const options = { tool: 'brush', color: '#e63946', size: 8 }

drawingDot(ctx, { x, y }, options) // a click that never moved
drawingStroke(ctx, from, to, options) // a segment of a drag
drawingFill(ctx, { x, y }, '#ffffff') // flood fill from a point
drawingClear(ctx)
```

Strokes are segments rather than paths on purpose: a segment is the unit that survives a
network hop, so the same `StrokeEvent` a local pointer produces can be sent to a peer and
replayed with no extra translation. `eraser` is a tool value, not a separate function, so
switching tools never changes the call site.

## History

Undo lives in [`@webgamekit/history`](./history.md), which every editor in this toolkit shares.
This package depends on it and re-exports it, so a canvas editor installed on its own still has
undo without a second copy of the stack existing. Painting stays here: `drawingRestore` is what
puts a snapshot back.

A canvas snapshots as a data URL of the whole canvas rather than as operation deltas — simple,
and immune to divergence between the recorded operations and what was actually painted. The
cost is memory per snapshot, so record on stroke completion rather than on every pointer move,
and keep the history's limit low enough that fifty full-size canvases are not held at once.

## Persistence

```typescript
import { storageSave, storageLoad, storageList } from '@webgamekit/canvas-editor'

await storageSave('indexedDB', 'slot-1', canvas.toDataURL())
const slot = await storageLoad('indexedDB', 'slot-1')
```

Two backends behind one interface. `localStorage` is synchronous and capped at a few
megabytes, which one large canvas can exceed; `indexedDB` is asynchronous and effectively
unbounded. The backend-specific functions (`storageSaveLocal`, `storageSaveIdb`, …) are
exported for a caller that has already made the choice.

## Textures

```typescript
import {
  textureLoadImage,
  textureResizeToMaxWidth,
  textureBuildCombined,
  textureToDataUrl
} from '@webgamekit/canvas-editor'
```

`textureBuildCombined` composes several canvases into one image, which is how a two-sided
model is painted on separate surfaces and delivered as a single texture.
`textureResizeToMaxWidth` caps the dimension before upload — a 4096px canvas is 64MB of VRAM
whatever the file size, so this is the difference between a texture that loads on a phone
and one that does not.

## API

| Function                                                | Returns                             | Description                 |
| ------------------------------------------------------- | ----------------------------------- | --------------------------- |
| `drawingStroke(ctx, from, to, options)`                 | `void`                              | Segment between two points  |
| `drawingDot(ctx, point, options)`                       | `void`                              | Single dot                  |
| `drawingFill(ctx, point, color)`                        | `void`                              | Flood fill                  |
| `drawingClear(ctx)`                                     | `void`                              | Clears the canvas           |
| `drawingRestore(ctx, dataUrl)`                          | `Promise<void>`                     | Paints a snapshot back      |
| `storageSave(backend, name, dataUrl)`                   | `Promise<void> \| void`             | Saves to the chosen backend |
| `storageLoad(backend, name)`                            | `Promise<StorageSlot \| null>` \| … | Loads a slot                |
| `storageDelete(backend, name)` / `storageList(backend)` | —                                   | Removes / enumerates slots  |
| `textureLoadImage(src)`                                 | `Promise<HTMLImageElement>`         | Loads an image              |
| `textureResizeToMaxWidth(...)`                          | `HTMLCanvasElement`                 | Caps the largest dimension  |
| `textureBuildCombined(...)`                             | `Promise<HTMLCanvasElement>`        | Composes canvases into one  |
| `textureToDataUrl(canvas, type?)`                       | `string`                            | Serialises a canvas         |

## Types

```typescript
type DrawingTool = 'brush' | 'eraser' | 'fill'

interface DrawingOptions {
  tool: DrawingTool
  color: string
  size: number
}

interface DrawingPoint {
  x: number
  y: number
}

interface StrokeEvent {
  from: DrawingPoint
  to: DrawingPoint
  options: DrawingOptions
}

interface FillEvent {
  point: DrawingPoint
  color: string
}

type StorageBackend = 'localStorage' | 'indexedDB'

interface StorageSlot {
  name: string
  dataUrl: string
  updatedAt: number
}
```
