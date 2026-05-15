---
sidebar_position: 21
---

# Memory Leak Detection in Three.js Views

Investigation and resolution of GPU and CPU leaks across all Three.js views, introduced as part of epic [#123](https://github.com/cnotv/generative-art/issues/123).

## Diagnosis

### The symptoms

Navigating between views left orphaned animation loops and unreleased WebGL contexts. Each unmounted view that did not call `renderer.dispose()` retained its GPU allocations. Views that did not cancel their `requestAnimationFrame` kept ticking in the background, burning CPU and interfering with the next view's rendering.

Both issues were invisible at first — the tab appeared fine — but compounded across multiple route changes.

### Static analysis

`pnpm analyze --code-only` was extended to scan for views that create a `WebGLRenderer` but never call `disposeScene` or `renderer.dispose()`. It flagged **13 views** on first run.

The **Debug panel** (`?debug=true`) showed Heap MB drifting upward across navigation cycles, confirming active leaks at runtime.

---

## Fix 1 — `disposeObject` and `disposeScene` helpers

Neither Three.js nor the project had a utility for recursively freeing a scene graph. Added to `packages/threejs/src/dispose.ts`:

```ts
export const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(disposeMaterial) // disposes material + all texture map slots
  })
}

export const disposeScene = (renderer: THREE.WebGLRenderer, scene?: THREE.Object3D): void => {
  if (scene) disposeObject(scene)
  renderer.dispose()
}
```

`disposeMaterial` iterates all known texture map keys (`map`, `normalMap`, `roughnessMap`, etc.) and calls `.dispose()` on each non-null texture. This prevents VRAM from being retained by orphaned texture uploads.

### Why `disposeObject` traverses, not iterates children

`scene.children` only lists direct children. Nested objects (a GLTF group containing sub-meshes) are invisible to a shallow loop. `traverse` walks the full tree regardless of depth.

---

## Fix 2 — 13 old-style views wired up

Every view that constructed its own `WebGLRenderer` was patched with the same three-line pattern:

```ts
let activeRenderer: THREE.WebGLRenderer | null = null

// inside setup()
activeRenderer = renderer

// inside onUnmounted()
if (activeRenderer) disposeScene(activeRenderer)
```

Views fixed: MoonView, EarthView, EarthGazer, MoonTwo, PhysicBall, PhysicBasic, ModelAnimation, CameraPresets, ThreejsExampleController, MetalCubes, MetalCubes2, CubeMatrixThreejs, ThreejsTemplate.

---

## Fix 3 — `cancelAnimationFrame` across 14 views

The animation loop leak was separate from the GPU leak. Even after disposing the renderer, `requestAnimationFrame` callbacks kept firing in the background.

Root cause: every `animate()` function called `requestAnimationFrame(animate)` but discarded the returned ID, making cancellation impossible.

Fix — store the ID at module scope:

```ts
let animationFrameId = 0

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  // ...
}

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
```

Views that re-run `setup()` on config change (via `controls.create` callback) also cancel the previous loop before starting the new one, preventing loop stacking.

---

## Fix 4 — `getTools()` cleanup centralised

Old-style views required this boilerplate manually. New views using `getTools()` get it for free via the returned `cleanup()` function, which was extended to cover all three resources:

```ts
const cleanup = () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (resize !== false) window.removeEventListener('resize', handleResize)
  disposeScene(renderer)
  activeRendererReference.current = null
}
```

Any view that calls `cleanup()` in `onBeforeUnmount` requires no additional disposal code.

---

## Fix 5 — `lookAt` type broadened in `CameraConfig`

While fixing views, two views (`GrassGenerator`, `ComplexAnimation`) crashed at runtime:

```
Uncaught TypeError: Spread syntax requires ...iterable[Symbol.iterator] to be a function
  at getLookAt (camera.ts:110)
```

Root cause: `CameraConfig.lookAt` was typed as `CoordinateTuple | Vector3` but callers passed `{ x, y, z }`. The `getLookAt` fallback spread it as an array.

Fix — `CameraConfig.lookAt` now accepts a third shape, and both `getLookAt` and `updateCamera` handle all three:

```ts
// types.ts
lookAt?: CoordinateTuple | THREE.Vector3 | { x: number; y: number; z: number }

// camera.ts — extracted to keep updateCamera under complexity limit
const applyCameraLookAt = (camera, lookAt) => {
  if (lookAt instanceof Array)          camera.lookAt(...lookAt)
  else if (lookAt instanceof Vector3)   camera.lookAt(lookAt)
  else                                  camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
}
```

---

## Tests added

### `packages/threejs/src/dispose.test.ts` (12 tests)

Covers `disposeObject` and `disposeScene` in isolation:

- Geometry disposal on a single mesh
- Recursive traversal across a deep scene graph
- Multi-material arrays
- All texture map keys (`map`, `normalMap`, `roughnessMap`, …)
- Null-safety (no error when geometry or material is absent)
- Call ordering — `disposeObject` runs before `renderer.dispose()`

### `src/tests/mountUnmount.test.ts` (10 tests)

Documents and enforces the disposal contract at the component level:

- `renderer.dispose()` called exactly once when component unmounts
- N mount/unmount cycles → exactly N dispose calls (catches re-mount regressions)
- Leaking component (no `disposeScene`) correctly does **not** call dispose — baseline for detecting regressions
- `WeakRef` GC-eligibility pattern documents that the component releases its strong reference after unmount

---

## Lessons

**GPU resources are invisible until they're gone.** Nothing warns when a texture or geometry is never freed — the tab just gets slower and eventually crashes. Dispose must be explicit and tested.

**Two separate leaks, same symptom.** The GPU leak (renderer not disposed) and the CPU leak (rAF not cancelled) look identical from outside the tab: sluggishness on navigation. Treating them together avoids fixing one while leaving the other.

**Centralise cleanup, not boilerplate.** The `getTools()` approach means a new view only needs one line in `onBeforeUnmount`. Per-view boilerplate was the root cause of the original 13 missed disposals — if the pattern is opt-in, it will be skipped.

**Type the full input space.** `CameraConfig.lookAt` accepted two forms in the type but three in practice. The third form was common in existing config objects but invisible until it crashed at runtime. When a utility function accepts a union, enumerate every shape it will realistically receive.
