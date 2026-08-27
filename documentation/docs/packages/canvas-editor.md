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

```typescript
import { historyCreate, historyPush, historyUndo, historyCanUndo } from '@webgamekit/canvas-editor'

let stack = historyCreate()
stack = historyPush(stack, canvas.toDataURL())

const { stack: undone, snapshot } = historyUndo(stack)
if (snapshot) await drawingRestore(ctx, snapshot)
```

Snapshots are data URLs of the whole canvas, not operation deltas — simple, and immune to
divergence between the recorded operations and what was actually painted. The cost is memory
per snapshot, so push on stroke completion rather than on every pointer move.

`historyPush` clears the redo future, which is what makes drawing after an undo behave the
way every editor behaves. Undo and redo return `{ stack, snapshot }`, with a `null` snapshot
when there is nothing to move to, so the caller can drive a disabled button state from
`historyCanUndo` / `historyCanRedo` instead of catching an error.

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

| Function                                                | Returns                             | Description                       |
| ------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| `drawingStroke(ctx, from, to, options)`                 | `void`                              | Segment between two points        |
| `drawingDot(ctx, point, options)`                       | `void`                              | Single dot                        |
| `drawingFill(ctx, point, color)`                        | `void`                              | Flood fill                        |
| `drawingClear(ctx)`                                     | `void`                              | Clears the canvas                 |
| `drawingRestore(ctx, dataUrl)`                          | `Promise<void>`                     | Paints a snapshot back            |
| `historyCreate()`                                       | `HistoryStack`                      | Empty stack                       |
| `historyPush(stack, snapshot)`                          | `HistoryStack`                      | Appends, clearing the redo future |
| `historyUndo(stack)` / `historyRedo(stack)`             | `{ stack, snapshot }`               | `snapshot` is `null` at the end   |
| `historyCanUndo(stack)` / `historyCanRedo(stack)`       | `boolean`                           | Button state                      |
| `storageSave(backend, name, dataUrl)`                   | `Promise<void> \| void`             | Saves to the chosen backend       |
| `storageLoad(backend, name)`                            | `Promise<StorageSlot \| null>` \| … | Loads a slot                      |
| `storageDelete(backend, name)` / `storageList(backend)` | —                                   | Removes / enumerates slots        |
| `textureLoadImage(src)`                                 | `Promise<HTMLImageElement>`         | Loads an image                    |
| `textureResizeToMaxWidth(...)`                          | `HTMLCanvasElement`                 | Caps the largest dimension        |
| `textureBuildCombined(...)`                             | `Promise<HTMLCanvasElement>`        | Composes canvases into one        |
| `textureToDataUrl(canvas, type?)`                       | `string`                            | Serialises a canvas               |

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

interface HistoryStack {
  past: string[]
  future: string[]
}

type StorageBackend = 'localStorage' | 'indexedDB'

interface StorageSlot {
  name: string
  dataUrl: string
  updatedAt: number
}
```
