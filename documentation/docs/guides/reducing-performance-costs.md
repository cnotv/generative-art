---
sidebar_position: 4
---

# Reducing Triangles, Draw Calls, and Heap MB

Use the **Debug panel** to read live metrics while your scene runs, and the **`analyze-assets` script** to audit the codebase before committing.

```bash
node scripts/analyze-assets.mjs          # full report
node scripts/analyze-assets.mjs --glb-only   # GLB triangle/size table only
node scripts/analyze-assets.mjs --code-only  # source code pattern check only
```

The script reports:

- Triangle and vertex counts per `.glb` file (colour-coded against thresholds)
- Loader singletons vs inline instantiation
- `InstancedMesh` usage vs individual `Mesh` instances
- Views that create a `WebGLRenderer` but never call `.dispose()`

---

## Draw calls

Each `THREE.Mesh` in the scene costs at least **one draw call per frame**. Every shadow-casting light multiplies that by the number of shadow passes.

### How to reduce

| Technique                        | When to use                                              | How                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`InstancedMesh`**              | Many copies of the same geometry (coins, trees, bullets) | Replace `new THREE.Mesh(geo, mat)` × N with one `new THREE.InstancedMesh(geo, mat, N)` and set each instance matrix. See `src/views/Experiments/ContinuousWorld/grassGenerator.ts`. |
| **Merge geometries**             | Static objects that never move independently             | `BufferGeometryUtils.mergeGeometries([...])` combines meshes into a single draw call.                                                                                               |
| **Reduce shadow-casting lights** | Too many directional/spot lights                         | One well-placed directional light is usually enough. Disable `castShadow` on lights that do not need it.                                                                            |
| **Frustum culling**              | Large open worlds                                        | Three.js enables this by default. Ensure `mesh.frustumCulled = true` (the default).                                                                                                 |
| **Material sharing**             | Multiple meshes with the same appearance                 | Share a single `Material` instance across meshes instead of creating a new one per mesh.                                                                                            |

### Target

| Draw calls | Status                              |
| ---------- | ----------------------------------- |
| < 100      | Green — safe for 60 fps             |
| 100–499    | Orange — monitor on low-end devices |
| ≥ 500      | Red — profile and reduce            |

---

## Triangles

High triangle counts cost GPU vertex-processing time. The Debug panel shows triangles **per frame**, not total scene triangles, so instanced geometry is counted once per instance.

### How to reduce

| Technique                 | When to use                                    | How                                                                                                                                 |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **LOD (Level of Detail)** | Large scenes with objects at varying distances | Use `THREE.LOD` to swap a high-poly mesh for a low-poly or sprite version beyond a distance threshold.                              |
| **Decimate on import**    | Individual high-poly GLB assets                | Open the file in [gltf.report](https://gltf.report/) or Blender → Decimate modifier. Aim for < 50 k triangles per standalone model. |
| **Impostors / sprites**   | Distant foliage, crowds, background objects    | Replace 3-D geometry with a camera-facing `PlaneGeometry` with a pre-rendered texture.                                              |
| **Reduce tessellation**   | Procedural geometry (spheres, cylinders)       | Pass a lower segment count: `new THREE.SphereGeometry(r, 16, 16)` instead of `(r, 64, 64)`.                                         |

### Checking a GLB

```bash
node scripts/analyze-assets.mjs --glb-only
```

The table shows triangles per file. Files over 50 k triangles are highlighted orange; over 200 k are red.

### Target

| Triangles / frame | Status |
| ----------------- | ------ |
| < 500 k           | Green  |
| 500 k – 1 M       | Orange |
| ≥ 1 M             | Red    |

---

## Heap MB

The JS heap grows when objects are allocated and never freed. Common causes in Three.js scenes:

- Geometries, materials, and textures created per frame (inside `requestAnimationFrame`)
- Models loaded on demand but never `.dispose()`d when removed
- Event listeners or Rapier rigid bodies not cleaned up on unmount

### How to reduce

**1. Dispose on unmount**

Every view that creates a `WebGLRenderer` must dispose it and all GPU resources in `onUnmounted`:

```ts
onUnmounted(() => {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose())
    } else {
      mesh.material?.dispose()
    }
  })
  renderer.dispose()
})
```

Views using `getTools()` have the renderer managed internally. Call `clearSceneElements()` in `onUnmounted` so the perf store drops its reference.

**2. Never allocate inside the animation loop**

The ESLint rule `no-alloc-in-animation-loop` (see `rules/`) flags this automatically. If you see the lint error, move the allocation outside `requestAnimationFrame` and mutate with `.set()` / `.copy()`:

```ts
// ✗ allocates every frame
const tickSimulation = () => {
  mesh.position.add(new THREE.Vector3(0, 0.1, 0))
}

// ✓ allocate once, mutate
const upStep = new THREE.Vector3(0, 0.1, 0)
const tickSimulation = () => {
  mesh.position.add(upStep)
}
```

**3. Pool short-lived objects**

Projectiles and particles that are created and destroyed frequently should come from a fixed-size pool. Allocate the array once and reset positions rather than pushing/splicing.

**4. Compress textures**

Embedded textures in GLB files are stored as PNG/JPEG and decoded to uncompressed RGBA in GPU memory. Use the `pnpm webp` script to convert images to WebP before embedding, or use KTX2/Basis Universal compression for in-GPU formats (requires `KTX2Loader`).

### Run the analysis

```bash
node scripts/analyze-assets.mjs --code-only
```

The **"Views with WebGLRenderer but no dispose()"** section lists files that create a renderer but never clean it up — start there.

### Target

| Heap MB    | Status |
| ---------- | ------ |
| < 100 MB   | Green  |
| 100–499 MB | Orange |
| ≥ 500 MB   | Red    |

---

## Quick checklist

Before shipping a new Three.js view, run through this list:

- [ ] `node scripts/analyze-assets.mjs` — no new red items
- [ ] Debug panel shows draw calls < 100 and triangles < 500 k during gameplay
- [ ] `onUnmounted` calls `clearSceneElements()` and disposes the renderer (if not using `getTools()`)
- [ ] No `new THREE.Vector3()` / `new THREE.Matrix4()` inside `requestAnimationFrame` callbacks
- [ ] Repeated geometry uses `InstancedMesh` or merged geometry, not individual `Mesh` instances
