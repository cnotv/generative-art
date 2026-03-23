---
sidebar_position: 1
---

# Development Journey

A living record of what has been built, the architectural decisions made along the way, and the technical lessons that came from them.

:::tip Keeping this doc up to date
When merging a PR, add any new architectural pattern, key lesson, or planned item introduced by the PR to the relevant section below. One bullet per lesson is enough — link to the PR for full context.
:::

---

## Timeline

```mermaid
gantt
  title WebGameKit — Project Timeline
  dateFormat YYYY-MM
  axisFormat %b %Y

  section Foundation
    Timeline & animation system (#4)          : done, 2024-01, 2024-02
    Texture editor tool (#2)                  : done, 2024-02, 2024-03
    Configuration interface / shadcn-vue (#3) : done, 2024-03, 2024-04
    Area population & pop-up animations (#5)  : done, 2024-04, 2024-05
    Vitest UI + browser mode (#9)             : done, 2024-05, 2024-06

  section Quality & Tooling
    ESLint v9 + functional programming (#13)  : done, 2024-06, 2024-07
    Fix deployment pipeline (#7)              : done, 2024-07, 2024-07

  section Features
    Pathfinding visualisation (#14)           : done, 2024-07, 2024-09
    Multi-button touch / faux-pad (#16)       : done, 2024-09, 2024-10
    Navigation bar & panel system (#28)       : done, 2024-10, 2024-11
    DrawPath + @webgamekit/logic (#24)        : done, 2024-11, 2025-01
    Unified element inspector (#23)           : done, 2025-01, 2025-02
    Continuous world / procedural terrain (#34): done, 2025-02, 2025-03

  section Planned
    Fix Vue Router query param bug (#32)      : active, 2025-03, 2025-04
    Landing page (#33)                        : 2025-04, 2025-05
    Controls mapping panel (#1)               : 2025-04, 2025-05
    First-person camera mode (#35)            : 2025-05, 2025-06
    Shaders scene (#36)                       : 2025-05, 2025-06
    Web worker image conversion (#37)         : 2025-06, 2025-07
    Procedural city from cubes (#48)          : 2025-06, 2025-08
    World map terrain scene (#51)             : 2025-07, 2025-09
    Multiplayer scribble duel game (#50)      : 2025-08, 2025-10
    Character customisation (#53)             : 2025-09, 2025-11
```

---

## Architecture Evolution

The codebase grew through three distinct stages: ad-hoc per-view setup, extraction into composables, and finally centralisation into Pinia stores.

```mermaid
flowchart TD
  A["Per-view boilerplate\ngetTools · setup · animate"] -->|"Config panel"| B

  B["Composables\nuseViewConfig · usePanels\nreusable but module-level refs\nleak state between tests"] -->|"sceneView store"| C

  C["Pinia stores\nuseSceneViewStore\nDevTools visible · clean lifecycle"]

  C --> D["Panel system\nPanelContainer left/right\nConfigPanel · DebugPanel\nElementsPanel"]
  C --> E["Global config\nglobalSceneSchema\nregistered once · shown everywhere"]
  C --> F["Element registry\nregisterCameraProperties\nregisterLightProperties\nregisterTextureAreaProperties"]
```

---

## Key Patterns

### Scene Lifecycle

Every Three.js view uses `useSceneViewStore` which wraps `getTools → setup → animate` in a consistent lifecycle.

```mermaid
sequenceDiagram
  participant Vue as Vue component
  participant Store as sceneViewStore
  participant Three as Three.js / Rapier

  Vue->>Store: init(canvas, setupConfig, { defineSetup })
  Store->>Three: getTools(canvas)
  Three-->>Store: scene · camera · world · animate
  Store->>Vue: defineSetup({ scene, camera, world, … })
  Vue->>Store: registerCameraProperties / registerLightProperties
  Store->>Store: animate({ timeline })
  Vue->>Store: cleanup() [onUnmounted]
  Store->>Three: dispose scene · destroy world
```

### Chunk Streaming (ContinuousWorld)

```mermaid
flowchart LR
  P[Player position] --> CC[computePlayerChunk]
  CC --> CR[computeRequiredChunks\nEuclidean radius]
  CR --> CL[computeChunksToLoad\nset difference]
  CR --> CU[computeChunksToUnload\nbeyond unload radius]
  CL --> GEN[createChunk\nterrain · trees · grass]
  CU --> DIS[disposeChunk\nremove from scene\ndispose geometry]
  GEN --> MAP[activeChunks Map]
  DIS --> MAP
```

Chunks are generated deterministically: the same `(chunkX, chunkZ)` always produces the same layout because all randomness is seeded from the chunk coordinates.

### Panel Registration

Panels are configuration-driven: views register a schema once and all panels update automatically. No per-component wiring needed.

```ts
// Any view — one call registers camera, lights, orbit in the Elements panel
registerCameraProperties(camera, orbitControls);
registerLightProperties(ambientLight, directionalLight);
```

The global `globalSceneSchema` (frame rate, text selection, bloom, vignette) is always present in every view's Config panel without any per-view registration.

### Functional Programming Conventions

| Rule | Reason |
|------|--------|
| No classes — use functions + types | Simpler composition, no `this` binding issues |
| No `for` loops — use `map`/`filter`/`reduce`/`flatMap` | Enforced by ESLint `functional/no-loop` |
| No module-level `ref()` in composables | Invisible to DevTools, never cleans up, stale state in tests |
| Deterministic seeds for procedural generation | Revisiting a chunk always produces the same result |

---

## Technical Complexities & Lessons

Grouped lessons extracted from all PRs. Each maps to a domain where the project repeatedly encountered the same class of problem.

### Three.js Rendering

- **Camera gimbal lock** on isometric transitions: always reset `camera.up` when repositioning a camera programmatically
- **`mixer.update()` double-call**: Three.js `finished` events fire synchronously inside `mixer.update()`; a handler that triggers another update advances the mixer twice in one frame
- **`renderOrder` in generic helpers**: setting it automatically in `getCube` caused draw-order conflicts; callers now set it explicitly
- **OrbitControls ↔ store sync**: `OrbitControls` mutates camera state directly — always add a `change` listener to sync it back to reactive config
- **Instanced grass / `alphaTest`**: using `alphaTest` on billboard sprites instead of `transparent: true` avoids per-frame depth sorting

### State & Reactivity

- **TypeScript `never` narrowing**: an unassigned `let x: T | null = null` where only `null` is assigned narrows to `never` after a null guard — use the most concrete type and assign early
- **`functional/immutable-data` scope**: this ESLint rule is `error` in `src/stores/` but `off` in `.vue` files — DOM side effects (`document.body.style`) must live in `App.vue`, not in stores
- **Composables → Pinia migration**: module-level `ref()` in composables is invisible to DevTools and never cleans up; migrate shared state to Pinia
- **Query param sync**: URL ↔ store sync must be tested end-to-end; it consistently broke after store refactors

### Animation & Physics

- **Timeline manager init order**: initialise managers at declaration time (`const tl = createTimeline()`), not inside conditional blocks — this bug regressed three times
- **Per-instance animation closures**: animation state must be encapsulated per-instance; shared external counters desync when animations overlap
- **Free camera vs. player independence**: camera mode and player movement are separate concerns — share input events but process them independently
- **Stratified sampling for placement**: pure `Math.random()` produces visually clumped distributions; use jittered grid sampling for natural-looking element placement

### Testing & CI

- **Browser tests in CI**: Vitest browser-mode tests are significantly slower than jsdom — benchmark against the CI time budget before adding them to the required pipeline
- **`pnpm` version pinning**: pin the pnpm version in CI to match the lockfile version; runner defaults change
- **TDD for complex state machines**: animation timelines with blocking/resuming transitions are strong TDD candidates — easy to unit-test in isolation, hard to reason about under real-time rendering
- **Parameterised tests with `it.each()`**: always use `it.each()` for multiple similar cases; separate `it()` calls for the same logic duplicate maintenance surface

### Linting & Code Quality

- **ESLint v9 flat config**: requires explicitly wiring parsers per file type; v8 implicit parser inheritance does not carry over
- **Mass auto-fix PRs accumulate conflicts**: lint-enforcement PRs that touch every file should be merged as quickly as possible
- **Schema detection discriminants**: schema parsers need a clear discriminant (e.g. presence of `min`/`max`) to distinguish nested groups from leaf controls; shape inference is fragile

### DevOps & Infrastructure

- **Orphaned Docker containers**: always pass `--remove-orphans` in deploy commands to avoid stale containers holding ports
- **Overwrite compose file on every deploy**: treat the server's `docker-compose.yml` as ephemeral — sync it from source before `docker compose up`
- **`workflow_dispatch` for safe fix verification**: add a manual trigger to deploy workflows so fixes can be tested without polluting the branch trigger config

---

## Planned Investigations

Open issues grouped by theme:

| Theme | Issues |
|-------|--------|
| **Rendering** | Shaders (#36), WebGPU stress test (#39), Textures showcase (#40), Post-processing with WASM/Rust/WebWorker (#41), Materials page (#42) |
| **Game mechanics** | First-person camera (#35), Enemy-chasing game (#26), Sphere-ground game (#18), Multiplayer scribble duel (#50) |
| **Procedural generation** | City from cubes (#48), World map terrain (#51), Character customisation (#53) |
| **Performance** | Web worker for image conversion (#37), IndexedDB for Three.js (#38), General perf optimisation (#19) |
| **Tooling** | Prettier (#46), Package example pages (#47), Live config VS Code sync (#22), Timeline editor (#20) |
| **Infrastructure** | Fix Vue Router query param (#32), Fix npm publishing (#8), Add loader (#12), Landing page (#33) |
| **DX** | Controls mapping panel (#1), Remove Three.js duplications (#44) |
