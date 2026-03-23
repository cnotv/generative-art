---
sidebar_position: 9
---

# Procedural Chunk Streaming

Building an infinite world that generates on demand as the player moves.

## Chunk Coordinate System

The world is divided into uniform square chunks. A chunk is identified by its integer grid coordinates `(chunkX, chunkZ)`, serialised to a string key `"chunkX,chunkZ"` for use as a `Map` key.

```ts
const chunkX = Math.floor(worldX / chunkSize);
const chunkZ = Math.floor(worldZ / chunkSize);
const key = `${chunkX},${chunkZ}`;
```

## Load/Unload Strategy

- **Load radius**: all chunks within a Euclidean distance of N chunk-widths from the player are required. Using Euclidean (circle) rather than Chebyshev (square) distance gives a more natural load boundary and avoids loading diagonal corners the player will never reach.
- **Unload radius**: set larger than the load radius (e.g. load=4, unload=6) to create hysteresis — chunks are not immediately unloaded as the player crosses the edge, preventing rapid load/unload cycling at the boundary.
- **Streaming**: loading all required chunks synchronously in one frame causes a visible freeze. Chunks are queued and a maximum of N are created per frame tick. This spreads the CPU cost over several frames with no perceptible stutter.

## Deterministic Generation

Every chunk is generated from a seed derived from its coordinates:

```ts
const seed = chunkX * 73856093 ^ chunkZ * 19349663;
```

This ensures the same chunk always produces the same terrain, trees, and grass regardless of the order it was loaded. The player can walk away and return to find the world unchanged.

## Height Sampling

Terrain height at any world XZ position is computed by raycasting straight down (`ray.direction = (0, -1, 0)`) from above the terrain mesh. This is used to:

- Snap the player's Y position to the surface each frame (terrain physics without a physics body)
- Place trees and grass at the correct height in the `all` case
- Offset the directional light to follow the player at a fixed height above terrain

A shared `HeightSampler` caches vertex heights per chunk so multiple systems (player snap, tree placement, grass placement) can query height without redundant raycasts.

## Forward Bias

Chunks directly ahead of the player's movement direction are loaded before chunks to the sides or behind. This hides generation latency behind the player's own forward momentum — by the time the player reaches the edge of a chunk, the next chunk is already loaded.

## Shared Geometry

Grass blade geometry (the Catmull-Rom curved blade profile) and its material are created once at scene mount and shared across all chunk `InstancedMesh` instances. Only the per-instance transformation matrices differ. This reduces GPU memory and avoids redundant shader compilation.

When a chunk is unloaded, only the `InstancedMesh` is disposed — `mesh.geometry.dispose()` and `mesh.material.dispose()` are intentionally **not** called, because the geometry and material are shared.
