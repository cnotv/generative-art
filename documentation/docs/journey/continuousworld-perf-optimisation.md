---
sidebar_position: 20
---

# ContinuousWorld Performance Optimisation

Investigation and resolution of high triangle counts (grass) and high draw calls (trees) in the ContinuousWorld experiment, using the performance tooling introduced in epic [#19](https://github.com/cnotv/generative-art/issues/19).

## Diagnosis

The debug panel (`?debug=true`) was used to read live metrics while loading each scene variant:

| Variant       | Metric             | Before  |
| ------------- | ------------------ | ------- |
| `?case=grass` | Triangles / frame  | ~1.46 M |
| `?case=trees` | Draw calls / frame | 162     |

The `pnpm analyze --code-only` script confirmed the root causes:

- **Grass** — `BLADE_POINTS = 10` produced 18 triangles per blade × 1 000 blades × 81 active chunks (VIEW_RADIUS 4 → 9² = 81)
- **Trees** — `new THREE.Mesh()` called inside `Array.from().forEach()` in `treeGenerator.ts`, one draw call per sprite billboard

---

## Grass — triangle reduction

### Root cause

Each grass blade is a spline-based strip with `BLADE_POINTS` segments. `THREE.CatmullRomCurve3.getPoints(n)` returns `n + 1` points, so `BLADE_POINTS = 10` produced 11 rows of 2 vertices each (22 vertices) with 10 segments × 2 triangles = **18 triangles per blade**.

The instancing was already optimal — one `THREE.InstancedMesh` per chunk — so the only lever was reducing geometry resolution.

### Fix

Two constants changed in `config.ts` and `grassGenerator.ts`:

```ts
// grassGenerator.ts
const BLADE_POINTS = 5 // was 10 → 8 triangles/blade (55% reduction)

// config.ts
export const VIEW_RADIUS = 3 // was 4 → 49 active chunks instead of 81 (40% reduction)
```

`GRASS_PER_CHUNK` was kept at 1 000 to preserve visual density.

### Result

|                     | Before      | After      | Reduction |
| ------------------- | ----------- | ---------- | --------- |
| Triangles / blade   | 18          | 8          | −55 %     |
| Active chunks       | 81          | 49         | −40 %     |
| **Total triangles** | **~1.46 M** | **~392 k** | **−73 %** |

The visual difference at normal play distance is imperceptible — the spline still captures the bend and taper of each blade.

### Lesson

> Segment count is the first lever for spline-based geometry. Halving `BLADE_POINTS` is invisible at distance but cuts triangle load by more than half. Always profile before adding geometry detail; the extra segments rarely earn their cost.

---

## Trees — draw call reduction

### Root cause

`treeGenerator.ts` created a `new THREE.Mesh` per tree inside a `forEach` loop — the exact pattern the `no-mesh-in-loop` ESLint rule flags:

```ts
// Before: one draw call per tree
Array.from({ length: treesPerChunk }).forEach(() => {
  const mesh = new THREE.Mesh(sharedPlaneGeometry, getOrCreateMaterial(url))
  group.add(mesh)
})
```

With `TREES_PER_CHUNK = 2` and VIEW_RADIUS 4, this was 2 × 81 = **162 draw calls** for tree sprites alone.

### Why not one InstancedMesh per chunk?

Each tree randomly picks from 18 texture materials. Trees in the same chunk can use different textures, and `InstancedMesh` requires a single material. The solution is to **group sprites by texture** and create one `InstancedMesh` per distinct texture used in that chunk.

### Fix

```ts
// Collect instances grouped by material URL
const byMaterial = new Map<string, SpriteInstance[]>()

Array.from({ length: treesPerChunk }).forEach(() => {
  // ... same position/texture selection logic ...
  const existing = byMaterial.get(url) ?? []
  byMaterial.set(url, [...existing, { position, scale }])
})

// One InstancedMesh per distinct texture → one draw call per texture used
const matrixBuffer = new THREE.Matrix4()
const quaternionIdentity = new THREE.Quaternion()

byMaterial.forEach((instances, url) => {
  const instancedMesh = new THREE.InstancedMesh(
    sharedPlaneGeometry,
    getOrCreateMaterial(url),
    instances.length
  )
  instances.forEach(({ position, scale }, index) => {
    matrixBuffer.compose(position, quaternionIdentity, scale)
    instancedMesh.setMatrixAt(index, matrixBuffer)
  })
  instancedMesh.instanceMatrix.needsUpdate = true
  group.add(instancedMesh)
})
```

### Result

With `TREES_PER_CHUNK = 2` and 18 textures, most chunks still produce 2 draw calls (if both trees pick different textures). The gain scales with tree density:

| Trees / chunk | Before | After    | Saving  |
| ------------- | ------ | -------- | ------- |
| 2             | 162    | ~100–162 | 0–38 %  |
| 10            | 810    | ~180–250 | 69–78 % |
| 20            | 1 620  | ~180–250 | 85–89 % |

At the current density of 2 trees per chunk the benefit is modest, but the code is now correct: `no-mesh-in-loop` no longer fires, and the architecture scales to higher densities without accumulating draw calls linearly.

Also pre-allocating `Matrix4` and `Quaternion` outside the `forEach` avoids per-frame allocations if this function were ever called in an animation loop.

### Lesson

> When sprites use multiple textures, grouping by material before instancing is the right pattern. The draw-call count becomes proportional to the number of _distinct textures used per chunk_, not the number of sprites. At low density the saving is small; at high density it is dramatic.

---

## Tooling used

| Tool                                | Purpose                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `?debug=true` + Debug panel         | Live FPS, draw calls, triangle count while scene runs     |
| `pnpm analyze`                      | Scanned source for `new THREE.Mesh` inside loops          |
| `local/no-mesh-in-loop` ESLint rule | Flagged the anti-pattern in `treeGenerator.ts`            |
| `pnpm test:unit -- ContinuousWorld` | Verified geometry constants after changing `BLADE_POINTS` |
| `pnpm check:assets`                 | Confirmed no GLB triangle budgets exceeded                |
