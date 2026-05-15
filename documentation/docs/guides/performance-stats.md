---
sidebar_position: 3
---

# Performance Stats in the Debug Panel

The Debug panel shows five live metrics for any active Three.js scene:

| Metric         | What it measures                             |
| -------------- | -------------------------------------------- |
| **FPS**        | Frames rendered per second (last 1 s window) |
| **Frame ms**   | Wall-clock time of the last frame            |
| **Draw calls** | WebGL draw calls issued in the last frame    |
| **Triangles**  | Triangles submitted in the last frame        |
| **Heap MB**    | JS heap used (Chrome / Chromium only)        |

Each value is colour-coded: **green** = healthy, **orange** = watch out, **red** = over budget.

## How it works

The metrics are stored in `usePerfMetricsStore` (`src/stores/perfMetrics.ts`).  
The DebugPanel drives its own `requestAnimationFrame` loop, calling `store.tick()` once per frame to snapshot the renderer state.

Draw calls and triangles come directly from `renderer.info.render` — the standard Three.js performance counters. `renderer.info.autoReset` is set to `false` so the counters accumulate for an entire frame and are only reset after being read.

## Registering a renderer

### Views using `getTools()`

No action needed. `getTools()` automatically writes the renderer to `activeRenderer`, which `usePerfMetricsStore` uses as a fallback.

```ts
// src/views/MyView.vue — nothing extra required
const { setup, animate, renderer } = await getTools({ canvas: canvas.value })
```

### Views with a manual renderer

Pass the renderer as the fourth argument to `registerSceneElements`:

```ts
const { registerSceneElements } = useDebugSceneStore()

// After creating your renderer:
registerSceneElements(camera, scene.children, undefined, renderer)
```

This stores the renderer in the perf store **and** disables `autoReset` automatically.

## Thresholds

| Metric     | Green   | Orange  | Red     |
| ---------- | ------- | ------- | ------- |
| FPS        | ≥ 55    | ≥ 30    | < 30    |
| Frame ms   | < 17 ms | < 34 ms | ≥ 34 ms |
| Draw calls | < 100   | < 500   | ≥ 500   |
| Triangles  | < 500 k | < 1 M   | ≥ 1 M   |
| Heap MB    | < 100   | < 500   | ≥ 500   |

## Opening the Debug panel

Click the **Debug** button in the top navigation bar, or add `?debug=true` to the URL to open it automatically.

## Interpreting draw calls

Each `Mesh` added to the scene costs at least one draw call per frame. Common causes of high draw call counts:

- **Many separate meshes** — merge geometries or use `InstancedMesh` (see the GPU Instancing guide).
- **Shadow maps** — each shadow-casting light re-renders the scene. Reduce shadow-casting lights or use `PCFSoftShadowMap`.
- **Transparent objects** — require a separate render pass.

A healthy scene for 60 fps should stay under **100 draw calls**.
