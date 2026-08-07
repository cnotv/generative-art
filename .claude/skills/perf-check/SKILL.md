---
name: perf-check
description: >-
  Use when a change adds or modifies a 3D scene, generator, model, texture or any other
  asset, and before pushing that change. Also use when something is reported as slow,
  janky, stuttering, laggy, dropping frames, heavy, or running badly on mobile, or when
  asked about FPS, frame time, draw calls, triangle count, memory or heap usage. Covers the
  debug panel, pnpm analyze, pnpm check:assets, the asset budget tests and their thresholds.
---

# Performance gate

Any change that touches a 3D scene, a generator or an asset passes this before it is
pushed. Measure first — the expensive thing is rarely the thing that looks expensive.

## Run these in order

| Tool           | Command                          | What it checks                                                                 |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Debug panel    | `?debug=true` in the URL         | Live FPS, draw calls, triangles, heap MB                                       |
| Asset analysis | `pnpm analyze`                   | Triangle counts per GLB, draw-call anti-patterns in source                     |
| Asset CI gate  | `pnpm check:assets`              | Fails if a GLB exceeds the size or triangle budget                             |
| ESLint         | `pnpm lint`                      | `no-mesh-in-loop`, `no-alloc-in-animation-loop`, `no-redundant-threejs-loader` |
| Budget tests   | `pnpm test:unit -- assetBudgets` | Per-file triangle and size limits, enforced in CI                              |

## Thresholds

| Metric     | Green        | Red            |
| ---------- | ------------ | -------------- |
| FPS        | at least 55  | under 30       |
| Frame time | under 17 ms  | 34 ms or more  |
| Draw calls | under 100    | 500 or more    |
| Triangles  | under 500 k  | 1 M or more    |
| Heap       | under 100 MB | 500 MB or more |

## When a metric is red

Fix it, then re-run the gate — a single pass proves nothing if the fix changed the scene.
The techniques are in `documentation/docs/guides/reducing-performance-costs.md`, and the
mobile-specific reasoning is in `documentation/docs/guides/mobile-performance.md`.

Budget for the phone, not the laptop: fill rate and texture memory bind long before
triangle count does. A 1024x1024 texture costs 4 MB of VRAM whatever its file size, so a
five-map PBR set is 20 MB for one object. Cap the renderer pixel ratio at 2 — a phone at
device pixel ratio 3 renders nine times the fragments. Drop displacement maps first, since
they cost both a fetch and the subdivided geometry that exists only to be moved by them.

If the scene needs to be lighter on mobile, vary the constants it is built from, resolved
once at startup. Never fork the render loop or the scene setup into separate desktop and
mobile paths — two paths means two sets of bugs, and one of them never gets looked at.

## Definition of done

Every command above has been run, no metric is red, and any number that moved is stated
with its before and after value rather than described as "improved".
