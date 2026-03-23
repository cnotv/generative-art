---
sidebar_position: 3
---

# InstancedMesh for Performance

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

## When `.clone()` Is Required

Sharing geometry and material works until instances need **different material properties** per group. In that case, `.clone()` the material and modify only the clone:

```ts
const uniqueMaterial = sharedMaterial.clone();
uniqueMaterial.color.set(0xff0000);
const mesh = new THREE.InstancedMesh(sharedGeometry, uniqueMaterial, count);
```

Common cases where cloning is necessary:

- **Per-chunk colour tinting**: terrain chunks with altitude-based colour shifts each need their own material instance to set a unique `color` or `uniforms` value.
- **Different opacity per group**: if one group of instances must be semi-transparent and another opaque, each group needs its own material (mixing `transparent` and opaque instances in one `InstancedMesh` is not supported).
- **Unique textures per group**: `InstancedMesh` uses one texture for all instances. To use different textures, either use a texture atlas (encode UV offset per instance via `instanceColor` or a custom attribute), or split into separate `InstancedMesh` objects with cloned materials.
- **Animated shader uniforms on a subset**: if only some chunks need a wind animation uniform updated each frame, clone the material for those chunks rather than updating the shared one (which would affect all instances globally).

**Dispose cloned materials explicitly**: unlike shared materials, cloned materials must be disposed when their `InstancedMesh` is removed — they are not referenced anywhere else.

```ts
mesh.material.dispose(); // safe: this is a clone, not the shared original
mesh.geometry.dispose(); // only if geometry was also cloned
```
