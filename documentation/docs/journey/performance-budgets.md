---
sidebar_position: 18
---

# Performance Budgets and Asset Validation

Automated guards to stop geometry bloat and oversized assets from entering the codebase undetected. Implemented as part of the performance optimization epic ([#19](https://github.com/cnotv/generative-art/issues/19)), subtask [#122](https://github.com/cnotv/generative-art/issues/122).

## The problem

Without automated checks, a contributor can:

- Increase terrain segment resolution and double the vertex count of every chunk silently
- Drop an 8 MB GLB into `public/` and ship it unchanged
- Let the JS bundle grow by 30% across several PRs with no single PR obviously at fault

None of these fail the build. By the time the problem is noticed, it may already be on production.

## What was added

Three layers of automated enforcement run on every PR.

### 1. Geometry vertex budget tests

Budget tests live alongside the generators they guard, inside a `describe('geometry budget')` block. They call the same factory functions used in production and assert the resulting geometry stays within a defined vertex limit.

```ts
describe('geometry budget', () => {
  const TERRAIN_VERTEX_BUDGET = 500

  it(`terrain chunk vertex count stays within budget of ${TERRAIN_VERTEX_BUDGET}`, () => {
    const mesh = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
    const vertexCount = mesh.geometry.getAttribute('position').count

    expect(vertexCount).toBeLessThan(TERRAIN_VERTEX_BUDGET)
  })
})
```

Budgets by generator:

| Generator                  | What is measured                        | Budget |
| -------------------------- | --------------------------------------- | ------ |
| `createTerrainChunk`       | Vertices per chunk                      | 500    |
| `createGrassBladeGeometry` | Vertices per blade (shared geometry)    | 60     |
| `createGrassChunk`         | Instances per chunk                     | 1 000  |
| `createElementsChunk`      | Vertices per element mesh               | 100    |
| `generateMazeAndSegments`  | Wall segments for default island config | 200    |
| `generateWallPositions`    | Perimeter wall positions                | 100    |

**Why `TERRAIN_SEGMENTS=16` → 289 vertices**: `THREE.PlaneGeometry(size, size, N, N)` creates `(N+1)²` vertices. At 16 segments that is `17×17 = 289`. The budget of 500 gives room for one step up (N=21 → 484) before the test fails and forces a deliberate review.

### 2. GLB asset size budget

`src/tests/assetBudgets.test.ts` reads every `.glb` file in `public/` at test time using Node's `fs.statSync` and checks it against a budget.

**Default budget: 2 MB per file.**

Files that are known to exceed the default budget are listed in an explicit allowlist with a comment explaining why and a reference to the issue tracking the fix:

```ts
const OVERSIZED_ALLOWLIST: Record<string, number> = {
  // 8.8 MB — high-poly table model; candidate for decimation (epic #19)
  'round_table.glb': 10_000_000
}
```

The test also has a stale-entry guard: if a file in the allowlist no longer exists in `public/`, the test fails. This prevents the allowlist from silently accumulating dead entries after assets are removed.

**What triggers a failure:**

- Adding a new `.glb` over 2 MB without an allowlist entry
- Growing an existing allowlisted file past its explicit limit
- Removing a `.glb` that has an allowlist entry without cleaning up the entry

### 3. JS bundle size check

`size-limit` with `@size-limit/file` measures the output of `vite build` without webpack coupling. Configuration lives in `.size-limit.json`:

```json
[
  {
    "name": "JS bundle (uncompressed)",
    "path": "dist/assets/*.js",
    "limit": "6 MB",
    "gzip": false
  },
  {
    "name": "CSS bundle (uncompressed)",
    "path": "dist/assets/*.css",
    "limit": "500 kB",
    "gzip": false
  }
]
```

Run locally after a build:

```sh
pnpm build-only
pnpm size
```

## How to evaluate performance after a change

### Geometry changes

Run the geometry budget tests directly:

```sh
pnpm test:unit -- terrainGenerator
pnpm test:unit -- grassGenerator
pnpm test:unit -- elementGenerator
pnpm test:unit -- MazeGame
```

If a budget test fails after you raised a segment count or added detail, you have three options:

1. **Revert the change** — the geometry is already complex enough
2. **Raise the budget** — only if the quality improvement justifies the vertex cost; document why in the PR
3. **Add LOD** — keep the high-detail version for close distances and swap in a lower-detail mesh at range (see issue [#121](https://github.com/cnotv/generative-art/issues/121))

### GLB assets

When adding or replacing a model:

```sh
du -sh public/<filename>.glb
```

If it exceeds 2 MB, reduce it before committing:

- **Decimate in Blender**: `Mesh → Clean Up → Decimate Geometry`, targeting a vertex count reduction of 50–80% for distant or small objects
- **Re-export with Draco compression**: in Blender's glTF export settings, enable `Draco mesh compression` — typically reduces binary size by 60–80% with near-identical visual quality
- **Strip unused data**: remove shape keys, vertex colors, and UV channels that the shader does not use

If the asset genuinely needs to be large (a hero model, a high-fidelity scene prop), add it to `OVERSIZED_ALLOWLIST` in `src/tests/assetBudgets.test.ts` with a byte limit and a comment. Do not raise the default budget.

### Bundle size

Check after each significant dependency addition or route split:

```sh
pnpm build-only && pnpm size
```

The `size` CI job runs automatically after `build` on every PR and fails the pipeline if the limits in `.size-limit.json` are exceeded.

To investigate what is contributing to bundle growth, run the Vite bundle analyzer:

```sh
npx vite-bundle-visualizer
```

This opens an interactive treemap of the output. Common culprits: Three.js examples shipped in full instead of tree-shaken, large JSON word lists imported statically, uncompressed texture atlases.

## Tightening budgets over time

The current limits are set to the baseline at time of implementation. As the codebase is optimized (instancing, LOD, asset decimation), tighten each budget to the new lower value so regressions are caught sooner:

1. Check the actual value in a passing test run (`console.log(vertexCount)` temporarily, or read it from the test output)
2. Set the budget to `Math.ceil(actual * 1.1)` — 10% headroom
3. Update the comment in the test explaining the derivation

For the bundle size, once tree-shaking and code-splitting improvements land, lower `.size-limit.json` limits in the same PR so the gains are locked in.
