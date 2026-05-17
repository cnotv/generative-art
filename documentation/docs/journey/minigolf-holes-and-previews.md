---
sidebar_position: 100
---

# Minigolf: Hole Configuration and SVG Previews

This documents how minigolf holes are defined in data, rendered in Three.js, and previewed as SVG thumbnails in the lobby.

## Hole configuration format

Every hole is described by a `HoleConfig` object in `config.ts`:

```ts
interface HoleConfig {
  ground: { width: number; depth: number; position: CoordinateTuple }
  walls: { width: number; depth: number; position: CoordinateTuple }[]
  teePosition: CoordinateTuple
  holePosition: CoordinateTuple
  par: number
}
```

The coordinate system is Three.js world space (Y-up). Ground and wall `position` values are centres of the respective rectangles. The hole is a gap in the ground created by placing four ground pieces around the `holePosition` — see the `groundPiecesAroundHole` helper.

### Typical values

- **Ground**: `width` = X extent, `depth` = Z extent. Most holes are narrower than they are deep (the camera looks straight down, Z = forward).
- **Walls**: The same `position`/`width`/`depth` triplet but interpreted as obstacle boxes. Walls that span more than ⅔ of the ground width act as baffles the ball must curve around.
- **Tee / hole**: `teePosition[1]` is always `BALL_RADIUS` so the ball spawns resting on the ground surface. `holePosition[1]` is `0` (ground level; the collider gap pulls the ball down from there).

### Design constraints

| Constraint                                     | Why                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Wall must not fully block the path             | The ball has no AI — a fully closed baffle means the hole is unplayable              |
| Hole position must be within the ground bounds | Otherwise the ground collider never has a gap at that XZ, so the ball cannot fall in |
| Par ≥ 2 for any obstacle hole                  | One stroke to get near, one to sink — fewer strokes produces frustration not fun     |

### Hole 6 dogleg redesign

The original hole 6 had `holePosition: [3, 0, 5]` but `ground.depth: 5` centred at `z: -4`, so the hole sat outside the green. The ball could never enter. It was remade as a proper dogleg:

```ts
// Old (broken)
ground: { width: 12, depth: 5, position: [3, 0, -4] },
holePosition: [3, 0, 5]   // ← z=5 is off the green

// New (dogleg)
ground: { width: 10, depth: 18, position: [0, 0, 0] },
walls: [{ width: 8, depth: 0.35, position: [-1, 0, 0] }],
teePosition: [-3, R, -7],
holePosition: [3, 0, 7]
```

The horizontal wall forces players to shoot around it before heading toward the cup.

## Camera fitting

The camera is positioned directly above the midpoint between tee and hole (`midX`, `midZ`). Its height is computed by `fitCamera()` from the ground dimensions and the actual canvas aspect ratio:

```ts
const halfFovRad = (perspCamera.fov * Math.PI) / 360
const heightForDepth = halfDepth / Math.tan(halfFovRad)
const heightForWidth = halfWidth / (aspect * Math.tan(halfFovRad))
camera.position.y = Math.max(heightForDepth, heightForWidth, CAMERA_OFFSET_TOPDOWN[1])
```

`aspect` is read from `canvasElement.clientWidth / clientHeight` — **not** `window.innerWidth / innerHeight`. Using window dimensions produced an incorrect aspect ratio when the game canvas is narrower than the full viewport (e.g., with the sidebar open), causing the hole to appear off-centre or clipped.

### The centering problem: Three.js `setSize` overrides canvas CSS

The hole was not centered despite correct camera math. The renderer was internally correct; the visual offset came from a conflict between Three.js and CSS layout.

When `getRenderer(canvas)` is called inside `getTools()`, it calls:

```ts
renderer.setSize(window.innerWidth, window.innerHeight)
```

`renderer.setSize` does two things:

1. Resizes the WebGL drawing buffer to the given dimensions.
2. **Injects `style.width` and `style.height` as inline styles** onto the canvas element (e.g. `style.width: 1440px`).

The canvas had `canvas { width: 100%; height: 100%; }` in the scoped stylesheet. Inline styles have higher specificity than class-based rules, so after `setSize`, the canvas was 1440 × 900 px (full window) even though its CSS container was only ~650 × 840 px (game area, sidebar excluded).

The result: the canvas overflowed its flex container, which clipped it to the container bounds. Because the renderer buffer was centered in 1440 × 900 and only the top-left 650 × 840 portion was visible, the hole — rendered at the buffer's center — appeared in the lower-right quadrant of the visible area. On mobile, the same problem shifted the hole downward.

The fix is in `refitCurrentHole()` in `useMinigolfGame.ts`:

```ts
// Strip the inline styles Three.js injected so CSS width:100%/height:100% takes effect
canvas.value.style.removeProperty('width')
canvas.value.style.removeProperty('height')

const w = canvas.value.clientWidth // now reflects the flex container's actual size
const h = canvas.value.clientHeight

// Resize the GPU buffer to match — false = do NOT re-inject inline styles
activeRendererReference.current?.setSize(w, h, false)
```

The third argument `false` to `setSize` is the `updateStyle` flag. It resizes the WebGL buffer without touching `style.width` or `style.height`, so subsequent reads of `clientWidth/clientHeight` continue to reflect the container's CSS size rather than the window size.

### ResizeObserver for late layout and sidebar toggling

At the time `buildHole()` runs (inside the `sceneStore.init` callback), the canvas may not yet have its final CSS-computed size because layout hasn't been flushed. `refitCurrentHole` is called once immediately after `buildHole` (fixing the initial frame), and a `ResizeObserver` is attached to re-run it whenever the canvas size changes:

```ts
canvasResizeObserver = new ResizeObserver(() => refitCurrentHole(ctx))
canvasResizeObserver.observe(canvas.value)
```

This handles browser window resize and sidebar toggling (which changes the canvas container width) without any additional wiring. The observer is disconnected in `cleanup()`.

## SVG lobby previews

The hole picker in the lobby shows a 64×64 SVG thumbnail for each hole. The `holeToSvgPaths(hole, size)` function in `helpers/holePreview.ts` converts the 3D `HoleConfig` into SVG path strings.

### Coordinate mapping

Three.js world X maps to SVG X; world Z maps to SVG Y (top of the SVG = most-negative Z = top of the hole, which is the tee end for all straight holes). Y is ignored (it is always ground level or ball radius).

```ts
const worldToSvgX = (worldX, offsetX, scale) => offsetX + worldX * scale
const worldToSvgY = (worldZ, offsetZ, scale) => offsetZ + worldZ * scale
```

### Auto-fit scale

`computeScale` collects every relevant X and Z coordinate (ground corners, tee, hole, wall corners) and fits them into the usable square with 8 px padding on each side:

```ts
const rangeX = maxX - minX || 1
const rangeZ = maxZ - minZ || 1
const usable = size - PADDING * 2
const scale = Math.min(usable / rangeX, usable / rangeZ)
```

Using `Math.min` ensures neither axis overflows the square. The offset centres whichever axis has spare space.

### Why SVG paths and not canvas

SVG scales crisply to any display resolution without re-drawing. The thumbnail is static (holes don't change during a game session), so there's no benefit to a canvas element. The host can't accidentally trigger a Three.js scene inside the wizard card.

### `rectPath` options object

The `rectPath` helper originally had seven positional parameters. ESLint `max-params` enforces a maximum of five, so the parameters were bundled into a `RectPathOptions` object:

```ts
type RectPathOptions = {
  cx: number
  cz: number
  w: number
  d: number
  offsetX: number
  offsetZ: number
  scale: number
}
```

This is the only reason for the named type — it is not used outside `holePreview.ts`.
