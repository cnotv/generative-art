---
sidebar_position: 16
---

# Materials Infographic Layout

## Goal

Build a visual reference scene that places one sphere per Three.js material type along a sine-wave path, with annotated labels, feature descriptions, and code-style property blocks — styled as a flat graphic rather than a 3D scene.

---

## Orthographic camera for a graphic effect

A perspective camera creates depth cues (foreshortening, vanishing point) that make a scene feel spatial. For an infographic, flat and uniform reads better. Switching to `THREE.OrthographicCamera` removes all perspective distortion — every sphere appears the same size regardless of depth, and the layout looks like a designed poster.

```ts
const camera = new THREE.OrthographicCamera(
  -halfWidth, // left
  halfWidth, // right
  halfHeight, // top
  -halfHeight, // bottom
  nearPlane,
  farPlane
)
camera.position.set(0, 0, distance)
camera.lookAt(0, 0, 0)
```

`halfWidth` is derived from the frustum height and the screen aspect ratio so the visible area scales correctly on resize:

```ts
const aspect = window.innerWidth / window.innerHeight
const halfWidth = ORTHO_FRUSTUM_HALF_HEIGHT * aspect
```

`getTools()` creates a perspective camera internally. When an orthographic camera is needed, pass `resize: false` to suppress the built-in resize handler, create the ortho camera separately, and run a manual render loop that uses it:

```ts
const { setup, renderer, scene } = await getTools({ canvas, resize: false })
const orthoCamera = createOrthographicCamera()

const animateLoop = (): void => {
  requestAnimationFrame(animateLoop)
  animateTimeline(timelineManager, frameCount++)
}
animateLoop()

// Inside a timeline action:
renderer.render(scene, orthoCamera)
```

`OrbitControls` works with an ortho camera without any special wiring — pass the same camera and the renderer's DOM element.

---

## Wave path with equal-arc-length placement

Placing objects at equal visual spacing on a sine wave is not the same as sampling the wave at equal parameter intervals. At steep portions of the wave the arc length is longer, so parameter-equal samples cluster near the peaks and spread near the zero-crossings.

`THREE.CatmullRomCurve3.getSpacedPoints(n)` solves this by walking the curve at equal **arc-length** intervals instead of equal parameter steps. Use it to get sphere positions:

```ts
const controlPoints = Array.from({ length: WAVE_SEGMENTS }, (_, i) => {
  const t = i / (WAVE_SEGMENTS - 1)
  const x = t * WAVE_WIDTH - WAVE_HALF_WIDTH
  const y = WAVE_AMPLITUDE * Math.sin(t * Math.PI * 2 * WAVE_CYCLES)
  return new THREE.Vector3(x, y, 0)
})
const curve = new THREE.CatmullRomCurve3(controlPoints)

// Equal arc-length positions for each material sphere
const positions = curve.getSpacedPoints(MATERIAL_TYPES.length - 1)
```

### Alternating text sides

Adjacent spheres alternate text above and below to avoid overlap. Even indices place text above the sphere (`textSide = +1`), odd indices below (`textSide = -1`):

```ts
const textSide = index % 2 === 0 ? 1 : -1
const labelY = position.y + textSide * LABEL_Y_OFFSET
const descriptionY = position.y + textSide * DESCRIPTION_Y_OFFSET
const propertiesY = position.y + textSide * PROPERTIES_Y_OFFSET
```

The Y offsets must account for the rendered sprite height so no two text layers overlap each other. For a sprite with `scaleY` per line and `N` lines the occupied height is `scaleY * N`. Leave at least that much clearance between adjacent offset values.

---

## Dashed tube path

WebGL does not support `linewidth > 1`. To draw a thick dashed line, create multiple short `TubeGeometry` segments with gaps between them:

```ts
const allPoints = curve.getSpacedPoints(WAVE_SEGMENTS)
const pointsPerDash = (WAVE_SEGMENTS + 1) / WAVE_DASH_COUNT
const dashPointCount = Math.floor(pointsPerDash * WAVE_DASH_DUTY)

Array.from({ length: WAVE_DASH_COUNT }, (_, i) => {
  const startIndex = Math.floor(i * pointsPerDash)
  const segmentPoints = allPoints.slice(startIndex, startIndex + dashPointCount + 1)
  if (segmentPoints.length < 2) return
  const segmentCurve = new THREE.CatmullRomCurve3(segmentPoints)
  const tube = new THREE.TubeGeometry(segmentCurve, dashPointCount, radius, radialSegments, false)
  group.add(new THREE.Mesh(tube, material))
})
```

`WAVE_DASH_DUTY` (0–1) controls how much of each dash+gap cycle is filled. `0.55` gives slightly wider dashes than gaps.

---

## Text sprites via canvas texture

`THREE.Sprite` always faces the camera, making it ideal for labels in an orthographic scene. The sprite's texture is a `CanvasTexture` drawn with the 2D Canvas API, which supports any font and multiline layout without loading external font assets.

The abstraction lives in `packages/threejs/src/sprites.ts` and is exported as `createTextSprite`:

```ts
createTextSprite({
  text: 'Lambert',
  fontSize: 72,
  scaleY: 0.45,
  color: '#ffffff',
  fontStyle: 'bold',
  canvasWidth: 512,
  autoAspect: true // derives scaleX from canvas aspect ratio
})
```

### Key options

| Option                    | Effect                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `autoAspect: true`        | Computes `scaleX` from `(canvasWidth / canvasHeight) * scaleY` so the font is not stretched        |
| `align: 'left'`           | Left-aligns each line of text within the canvas                                                    |
| `centerBlock: true`       | Measures the widest line and shifts the draw origin so the block is visually centred on the sprite |
| `fontFamily: 'monospace'` | Proportional fonts ignore leading spaces; monospace preserves indentation                          |

### Centering a left-aligned block

`textAlign = 'left'` with a fixed left margin places the text near the canvas edge, making the sprite appear offset. To centre the block while keeping lines left-aligned, measure the widest line and compute the starting x:

```ts
const maxLineWidth = Math.max(...lines.map((line) => context.measureText(line).width))
const xStart = (canvasWidth - maxLineWidth) / 2
// draw every line at xStart
```

### Multiline height scaling

Each line occupies `canvasHeight` pixels. The total canvas height is `canvasHeight * lines.length`. The sprite's Y scale must match:

```ts
sprite.scale.set(scaleX, scaleY * lines.length, 1)
```

This keeps the per-line pixel density constant regardless of how many lines the text has.

### Code-style property blocks

Properties are rendered with `fontFamily: 'monospace'` and `centerBlock: true` so the `{` / `}` brackets and indented property names appear as a centred code block:

```ts
createTextSprite({
  text: '{\n  roughness: number\n  metalness: number\n}',
  fontFamily: 'monospace',
  align: 'left',
  centerBlock: true,
  color: '#88aaff'
})
```
