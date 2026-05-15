---
sidebar_position: 5
---

# Avoiding Memory Leaks in Three.js Views

Every Three.js view allocates GPU resources (geometries, materials, textures, render targets) and starts a `requestAnimationFrame` loop. If these are not released when the component unmounts, they accumulate across route changes and eventually crash the tab.

---

## The two leak types

| Type              | Symptom                                                             | Root cause                                                        |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **GPU leak**      | VRAM grows on every route change, WebGL context eventually lost     | `renderer.dispose()` never called, geometries/materials not freed |
| **CPU loop leak** | CPU stays high after leaving a view, multiple loops race each other | `requestAnimationFrame` ID never cancelled                        |

---

## Views using `getTools()`

`getTools()` returns a `cleanup()` function that handles everything automatically:

```ts
import { getTools } from '@webgamekit/threejs'
import { onBeforeUnmount } from 'vue'

const { renderer, scene, camera, animate, setup, cleanup } = await getTools({ canvas, route })

onBeforeUnmount(() => {
  cleanup() // cancels rAF loop + disposes renderer + clears activeRendererReference
})
```

`cleanup()` does three things in order:

1. `cancelAnimationFrame(animationFrameId)` — stops the loop started by `animate()`
2. `window.removeEventListener('resize', handleResize)` — removes the auto-resize handler
3. `disposeScene(renderer)` — frees all GPU resources and calls `renderer.dispose()`

No per-view tracking of animation IDs or renderer references is needed.

---

## Old-style views (manual renderer setup)

Views that create their own `WebGLRenderer` must manage cleanup explicitly. Use this pattern:

```ts
import { disposeScene } from '@webgamekit/threejs'
import { onBeforeUnmount } from 'vue'

let activeRenderer: THREE.WebGLRenderer | null = null
let animationFrameId = 0

const setup = () => {
  const renderer = new THREE.WebGLRenderer({ canvas })
  activeRenderer = renderer

  function animate() {
    animationFrameId = requestAnimationFrame(animate)
    renderer.render(scene, camera)
  }
  animate()
}

// Cancel old loop before re-running setup on config change
controls.create(config, route, {}, () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  setup()
})

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (activeRenderer) disposeScene(activeRenderer)
})
```

Key rules:

- Always cancel the previous rAF before calling `setup()` again (e.g. on dat.GUI config change)
- Always call `disposeScene` (not just `renderer.dispose()`) — it also traverses the scene graph and frees geometries, materials, and textures

---

## Disposing individual objects

When removing an object from the scene mid-session (not on full unmount), use `disposeObject`:

```ts
import { disposeObject } from '@webgamekit/threejs'

// Remove and free a single mesh or subtree
disposeObject(mesh)
scene.remove(mesh)
```

`disposeObject` traverses the object graph, calling `.dispose()` on every geometry and material (including each entry in material arrays and all texture map slots).

---

## Shared geometry and material

When multiple meshes share the same geometry or material (e.g. `InstancedMesh` patterns), dispose the shared resource only **once**, after all meshes are removed:

```ts
// chunk unload — remove from scene, do not dispose shared resources
scene.remove(instancedMesh)

// view unmount — dispose shared resources exactly once
onBeforeUnmount(() => {
  sharedGeometry.dispose()
  sharedMaterial.dispose()
})
```

Calling `.dispose()` on a geometry or material that is still in use by another mesh will corrupt those meshes silently.

---

## Detecting leaks

### Debug panel

Open `?debug=true` and navigate between views. If **Heap MB** keeps climbing after returning to a view, a leak is present.

### Static analysis

```bash
node scripts/analyze-assets.mjs --code-only
```

The script flags views that instantiate a `WebGLRenderer` but have no `disposeScene` or `renderer.dispose()` call.

### ESLint rule

`local/no-mesh-in-loop` flags `new THREE.Mesh()` inside `forEach` / `map` / `for-of` loops — a common cause of unbounded draw-call growth that also often hides disposal issues.

### Unit tests

`src/tests/mountUnmount.test.ts` verifies the disposal contract:

- `renderer.dispose()` is called exactly once per unmount
- N mount/unmount cycles produce exactly N dispose calls
- A leaking component (no `disposeScene`) correctly fails the test

Use these as a reference when adding new Three.js views.
