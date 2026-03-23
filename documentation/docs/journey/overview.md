---
sidebar_position: 1
---

# Technical Journey

Findings, discoveries, and hard-won lessons from building with Three.js, Rapier, and the surrounding toolchain. Each section captures what was learned while solving a real problem in this project.

:::tip Keeping this doc up to date
When a PR introduces a notable technical finding — especially something non-obvious or that caused a bug — add a bullet to the relevant section below.
:::

---

## Z-Fighting

Z-fighting occurs when two coplanar surfaces compete for the same depth buffer value, producing a flickering pattern where neither surface clearly wins.

**Root cause**: the depth buffer has finite precision, so two surfaces at the same Z depth produce identical values. The GPU picks arbitrarily per-fragment, and this changes frame to frame as the camera moves.

**Solutions used in this project**:

- **`polygonOffset`** on the material: nudges the depth value of one surface slightly forward without moving its geometry. Useful for decals or ground markings placed on top of terrain.

```ts
new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
```

- **Physical separation**: when possible, place the secondary surface a tiny distance above the base (e.g. grass blades at `y + 0.01`) rather than fighting the depth buffer.
- **`renderOrder`**: for transparent objects, set explicit render order rather than relying on depth sort. The automatic sort in `getCube` was removed because it caused unpredictable ordering when mixing opaque and transparent meshes.

---

## InstancedMesh for Performance

Rendering many identical objects (grass blades, trees, particles) with individual `Mesh` instances sends one draw call per object. At thousands of objects this saturates the CPU–GPU command buffer.

**`THREE.InstancedMesh`** batches all instances into a single draw call. Only the per-instance transformation matrix (position, rotation, scale) differs.

```ts
const mesh = new THREE.InstancedMesh(geometry, material, count);
const matrix = new THREE.Matrix4();
Array.from({ length: count }).forEach((_, i) => {
  matrix.compose(position, quaternion, scale);
  mesh.setMatrixAt(i, matrix);
});
mesh.instanceMatrix.needsUpdate = true;
```

**Key findings**:

- Geometry and material must be **shared** across all instances — create them once, reuse across chunks.
- Call `instanceMatrix.needsUpdate = true` after any matrix change, otherwise Three.js skips the GPU upload.
- For billboard sprites (trees), `alphaTest` (cutout rendering) avoids per-frame depth sorting and is cheaper than `transparent: true`, which requires the renderer to sort all transparent objects by depth every frame.
- Per-chunk `InstancedMesh` instances can be disposed individually on chunk unload: `mesh.dispose()` releases the GPU buffer without touching the shared geometry/material.

---

## Pathfinding

A\* pathfinding on a uniform grid is straightforward in 2D but requires additional handling for 3D terrain.

**Grid construction**: the world is divided into a uniform grid of nodes. Each node stores walkability and, in 3D scenes, its Y height sampled from the terrain.

**A\* specifics**:

- Uses a min-heap (priority queue) on `f = g + h` where `h` is the Euclidean distance to the goal.
- Diagonal movement is allowed with a cost of `√2` vs `1` for cardinal directions.
- Obstacle nodes are excluded from the open set.

**3D height snapping**: pathfinding operates on the XZ plane; Y is determined by raycasting downward from the node's XZ position onto the terrain mesh. Without this, agents float or clip through hills.

**Path smoothing**: raw A\* paths hug the grid and look mechanical. A post-process pass (string-pulling / funnel algorithm) removes redundant waypoints where line-of-sight exists between non-adjacent nodes.

**Path following**: the agent moves toward the next waypoint each frame. When within a threshold distance, it advances to the next node. The threshold must be larger than the per-frame movement step, otherwise the agent can overshoot and oscillate.

---

## Animation with Three.js

### AnimationMixer

The `THREE.AnimationMixer` drives skeletal and morph-target animations. It must be updated every frame with the elapsed delta:

```ts
mixer.update(delta);
```

**Double-update bug**: the `finished` event on an `AnimationAction` fires synchronously inside `mixer.update()`. If the event handler also calls `mixer.update()`, the mixer advances twice in one frame — animations skip a frame and timing breaks. Guard the handler so it only fires once and never calls `mixer.update()` recursively.

### AnimationAction transitions

Blending between actions (e.g. walk → idle) uses `crossFadeTo`:

```ts
idleAction.reset().fadeIn(0.3);
walkAction.fadeOut(0.3);
```

Calling `action.reset()` before `fadeIn` is important — without it, if the action was previously playing at the end of its clip, it starts from the last frame instead of the beginning.

### Blocking animations

Some actions (attacks, jump start) must complete fully before the character can move again. Implemented by:

1. Playing the clip with `action.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true`
2. Listening to `mixer.addEventListener('finished', handler)`
3. Only resuming movement logic after the event fires

The `finished` event includes the `action` that finished, so multiple blocking clips can share one listener.

### Timeline system

The project uses a frame-accurate timeline manager rather than raw `requestAnimationFrame` callbacks. Each action declares its update frequency (every N frames) and priority. This decouples "how often does physics run" from "how often does the camera update", and makes it easy to throttle expensive operations (chunk streaming, shadow map updates) without touching render frequency.

---

## Binding Three.js Data to Vue

Three.js mutates objects in place — `mesh.position.x = 5` does not trigger Vue's reactivity system. Bridging the two requires deliberate effort.

### Strategies used

**Store-mediated updates**: Three.js callbacks (OrbitControls `change` event, animation loop) write to a Pinia store. Vue components read from the store reactively.

```ts
orbitControls.addEventListener('change', () => {
  cameraConfigStore.position = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };
});
```

**`toRaw` for Three.js objects**: wrapping a Three.js object in a Vue `ref` or `reactive` causes Vue to deeply proxy every property, which breaks internal Three.js assumptions (e.g. `instanceof` checks, internal `__webglTexture` references). Use `markRaw` when storing Three.js objects in reactive state, or `toRaw` before passing them to Three.js APIs.

```ts
const orbit = toRaw(store.orbitReference); // unwrap before use
```

**One-way data flow for config**: UI sliders write config values into a Pinia store. The animation loop reads from the store each frame and applies the values to Three.js objects. This avoids two-way bindings that would cause feedback loops.

### Issues encountered

- **OrbitControls bypassing reactivity**: panning/zooming with OrbitControls directly mutates `camera.position` without going through any store. The camera panel stayed stale until a `change` listener was wired to sync back.
- **Reactive proxy breaking `instanceof`**: storing a `THREE.Scene` inside `reactive({})` wrapped it in a Proxy. Rapier physics checks `obj instanceof THREE.Mesh` internally and failed silently. Fix: `markRaw(scene)` before storing.
- **`watchEffect` for DOM side effects**: `document.body.style.userSelect` can't be set inside a Pinia store (ESLint `functional/immutable-data` is `error` in stores). Moved to `App.vue`'s `watchEffect`, which is the correct place for DOM side effects driven by reactive state.

---

## Faux-Pad (Touch Controls)

A virtual joystick rendered as a DOM element — the user drags from a center point and the displacement vector drives input actions.

### Key findings

- **Circular boundary clamping**: without clamping, the thumb can be dragged far outside the visual circle, producing extreme axis values. The displacement vector must be clamped to the circle's radius before normalisation.

```ts
const distance = Math.min(Math.hypot(dx, dy), maxRadius);
const angle = Math.atan2(dy, dx);
```

- **8-way directional detection**: converting the angle to one of 8 sectors (N, NE, E, SE, S, SW, W, NW) requires dividing the circle into 45° arcs. An `axisThreshold` (dead zone) prevents accidental diagonals when the user intends a cardinal direction.
- **Touch event `change` fires only on new file**: the browser's file input `change` event does not fire if the same file is re-selected. Fix: clear `input.value = ''` after processing so the browser treats the next selection as a new change.
- **`touchend` must release all active actions**: when the user lifts their finger, every action that was active for that touch identifier must be explicitly released. Missing this causes "stuck" keys where the character keeps moving after the finger is lifted.
- **Active touch tracking by identifier**: if multiple touches are active, each touch must be tracked by `touch.identifier`, not by index. Index-based tracking breaks when a second finger lands and changes the array order.

---

## Docker Deployment

### Problems encountered

- **Orphaned containers blocking the port**: a previous deployment left containers running. The new `docker compose up` started fresh containers but the old ones still held the port, causing a silent bind failure. Fix: always pass `--remove-orphans` to `docker compose up`.
- **Stale `docker-compose.yml` on the server**: the compose file on the server had diverged from the repo, so deployments used old configuration. Fix: always `scp` (or `rsync`) the compose file from the repo to the server as the first deployment step — treat the server's copy as ephemeral.
- **No way to test the fix without touching main**: the deploy workflow only triggered on `main`, making it impossible to verify a fix on a feature branch. Fix: add a `workflow_dispatch` trigger to the deploy workflow so any branch can trigger a manual deploy for verification.

---

## ContinuousWorld — Procedural Chunk Streaming

Building an infinite world that generates on demand as the player moves.

### Chunk coordinate system

The world is divided into uniform square chunks. A chunk is identified by its integer grid coordinates `(chunkX, chunkZ)`, serialised to a string key `"chunkX,chunkZ"` for use as a `Map` key.

```ts
const chunkX = Math.floor(worldX / chunkSize);
const chunkZ = Math.floor(worldZ / chunkSize);
const key = `${chunkX},${chunkZ}`;
```

### Load/unload strategy

- **Load radius**: all chunks within a Euclidean distance of N chunk-widths from the player are required. Using Euclidean (circle) rather than Chebyshev (square) distance gives a more natural load boundary and avoids loading diagonal corners the player will never reach.
- **Unload radius**: set larger than the load radius (e.g. load=4, unload=6) to create hysteresis — chunks are not immediately unloaded as the player crosses the edge, preventing rapid load/unload cycling at the boundary.
- **Streaming**: loading all required chunks synchronously in one frame causes a visible freeze. Chunks are queued and a maximum of N are created per frame tick. This spreads the CPU cost over several frames with no perceptible stutter.

### Deterministic generation

Every chunk is generated from a seed derived from its coordinates:

```ts
const seed = chunkX * 73856093 ^ chunkZ * 19349663;
```

This ensures the same chunk always produces the same terrain, trees, and grass regardless of the order it was loaded. The player can walk away and return to find the world unchanged.

### Height sampling

Terrain height at any world XZ position is computed by raycasting straight down (`ray.direction = (0, -1, 0)`) from above the terrain mesh. This is used to:

- Snap the player's Y position to the surface each frame (terrain physics without a physics body)
- Place trees and grass at the correct height in the `all` case
- Offset the directional light to follow the player at a fixed height above terrain

A shared `HeightSampler` caches vertex heights per chunk so multiple systems (player snap, tree placement, grass placement) can query height without redundant raycasts.

### Forward bias

Chunks directly ahead of the player's movement direction are loaded before chunks to the sides or behind. This hides generation latency behind the player's own forward momentum — by the time the player reaches the edge of a chunk, the next chunk is already loaded.

### Shared geometry

Grass blade geometry (the Catmull-Rom curved blade profile) and its material are created once at scene mount and shared across all chunk `InstancedMesh` instances. Only the per-instance transformation matrices differ. This reduces GPU memory and avoids redundant shader compilation.

When a chunk is unloaded, only the `InstancedMesh` is disposed — `mesh.geometry.dispose()` and `mesh.material.dispose()` are intentionally **not** called, because the geometry and material are shared.
