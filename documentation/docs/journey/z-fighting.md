---
sidebar_position: 2
---

# Z-Fighting

Z-fighting occurs when two coplanar surfaces compete for the same depth buffer value, producing a flickering pattern where neither surface clearly wins.

**Root cause**: the depth buffer has finite precision, so two surfaces at the same Z depth produce identical values. The GPU picks arbitrarily per-fragment, and this changes frame to frame as the camera moves.

**Solutions used in this project**:

- **`polygonOffset`** on the material: nudges the depth value of one surface slightly forward without moving its geometry. Useful for decals or ground markings placed on top of terrain.

```ts
new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
```

- **Physical separation**: when possible, place the secondary surface a tiny distance above the base (e.g. grass blades at `y + 0.01`) rather than fighting the depth buffer.
- **`renderOrder`**: for transparent objects, set explicit render order rather than relying on depth sort. The automatic sort in `getCube` was removed because it caused unpredictable ordering when mixing opaque and transparent meshes.
