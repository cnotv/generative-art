---
sidebar_position: 99
---

# Bubble Shooter: Hex Grid, Snap, Match, and Row Pressure

This documents the non-obvious problems encountered while building the Bust-a-Move / Puzzle Bobble style bubble shooter (PR #145).

## Hex grid: odd-row overflow

The grid is 9 columns wide. Odd rows are offset right by half a bubble diameter to create the classic honeycomb pattern. The first implementation placed 9 bubbles in every row — but odd-row column 8 (zero-indexed) starts at x = 4.0 and has radius 0.5, so its right edge reaches x = 4.5, which is exactly on the wall boundary. Any floating-point overshoot caused the ball to clip through.

The fix: odd rows have **8 columns** (`GRID_COLS - 1`), not 9. A single helper encapsulates this:

```ts
const rowColCount = (row: number): number => (row % 2 === 0 ? GRID_COLS : GRID_COLS - 1)
```

Every function that iterates columns — `createGrid`, `snapToCell`, `addGarbageRows`, `addTopRows` — uses this helper. Skipping it in any one place reintroduces the overflow.

## Row drop parity: always add two rows

When the grid descends under time pressure, adding **one** row flips the odd/even parity of every existing row. A bubble that was in an even row (straight alignment) becomes an odd row (offset alignment) — it visually jumps half a bubble width to the right. This looks like a glitch and shifts all snapping calculations.

The invariant: **always add rows in multiples of 2**. `addTopRows(grid, 2)` is the only call site. Adding 2 preserves parity for all existing cells.

## Camera aspect ratio: bypassing `getTools()`

The `getEnvironment` helper inside `@webgamekit/threejs` initialises the camera aspect ratio from `window.innerWidth / window.innerHeight`. When a 280 px sidebar is present, the actual canvas is roughly 280 px narrower than the window. The result is an aspect ratio that is too wide — the grid appears shifted to the right and partially off-screen.

The fix is to bypass `getTools()` entirely and initialise Three.js directly from the canvas element:

```ts
const w = el.clientWidth || el.offsetWidth || 400
const h = el.clientHeight || el.offsetHeight || 600
const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true })
renderer.setSize(w, h, false)
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 1000)
```

A `ResizeObserver` watches the canvas element and updates the renderer and camera aspect whenever the sidebar appears or disappears.

## Bubble generation: two-slot color queue

The HUD shows two circles: the bubble currently loaded in the barrel (fires next) and a preview of the one after. The first implementation populated both from a single `pickNextColor()` call on shoot, so the "next" preview was replaced the moment the player fired — the displayed color changed mid-flight, making it impossible to plan.

The correct model: **shift on landing, not on shoot**.

```
currentColor  ← the bubble that fires
nextColor     ← the preview shown in HUD
```

On collision and snap:

```ts
ctx.currentColor.value = ctx.nextColor.value // shift
ctx.nextColor.value = pickNextColor(ctx.grid) // refill preview
ctx.loadedMesh.material = getMaterial(ctx, ctx.currentColor.value)
ctx.loadedMesh.visible = true
```

On shoot, the loaded mesh is hidden (it becomes the in-flight mesh) but `currentColor` does not change until landing.

## Stick logic: snapping to the nearest empty cell

When the in-flight bubble collides with a grid bubble or reaches the ceiling, it must snap to the nearest valid empty hex cell. `snapToCell(hitX, hitY, grid)` iterates all cells, converts each to world coordinates via `cellToWorld(row, col)`, and returns the cell with the minimum Euclidean distance to the hit point. Cells where `col >= rowColCount(row)` are excluded.

After snap:

1. Set `grid[row][col].color` to the bubble's color.
2. Place a mesh at the cell's world position.
3. Run `findMatch` to check for a group of ≥ 3.
4. Run `findDangling` to drop any bubbles disconnected from the ceiling.

## Explode logic: BFS match and dangle

**Match (pop):** `findMatch(row, col, grid)` runs a BFS from the placed cell, collecting all connected cells with the same color. If the group size is ≥ `MIN_MATCH_SIZE` (3), every cell in the group is cleared from the grid and its mesh is removed from the scene. Each popped bubble spawns 6 pop particles with randomised directions, 0.35 s lifetime, and 3.5 units/s speed.

**Dangle (fall):** `findDangling(grid)` runs a second BFS starting from every filled cell in row 0 (the ceiling row). Any filled cell not reachable from row 0 is "dangling" — it has no path to the ceiling. Dangling cells are cleared and their meshes removed. This handles the common Bust-a-Move mechanic where popping a cluster causes a chain of unsupported bubbles to fall.

Both passes happen on every landing, in order: match first, then dangle on whatever remains.

## Advance logic: row pressure and game over

**Row pressure:** every `rowDropMs` milliseconds (driven by the `speed` setting — 30 s slow, 20 s medium, 12 s fast), two new rows of randomly colored bubbles are prepended to the top of the grid. The accumulator pattern avoids `setInterval` drift:

```ts
ctx.rowDropAccumulator += delta * 1000
if (ctx.rowDropAccumulator >= rowDropMs) {
  ctx.rowDropAccumulator -= rowDropMs
  ctx.grid = addTopRows(ctx.grid, 2)
  rebuildAllMeshes(ctx)
}
```

**Game over:** `hasReachedFireLine(grid, FIRE_LINE_Y)` scans all occupied cells and returns `true` if any cell's world Y coordinate is ≤ the fire line.

The fire line Y is derived, not hardcoded:

```ts
export const FIRE_LINE_Y = GRID_TOP_Y - (GRID_ROWS - 2) * HEX_ROW_HEIGHT
```

An earlier version used `-6.0`. The grid bottom sits at approximately `-4.0`, so game-over never triggered — the fire line was below the grid entirely. The formula places it just above the last playable row regardless of grid dimensions.

## Multiplayer: separate grids, garbage rows

Each player manages their own local grid. The opponent's grid is never transmitted — only their score is broadcast via a `bs-score` channel.

Clearing a complete row sends a `bs-garbage` message with a count. The opponent calls `addGarbageRows(grid, count)`, which prepends gray (`'garbage'`) rows to their grid. Gray bubbles participate in snap and dangle but not in match (they cannot form a color group).

Game over is self-reported: `bs-gameover {}` tells the peer they are out. The receiver becomes the winner. This avoids needing to synchronise exact grid state across the network.
