---
sidebar_position: 2
---

# Architecture Patterns

## Evolution

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

## Scene Lifecycle

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

---

## Chunk Streaming

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

---

## Panel Registration

Panels are configuration-driven: views register a schema once and all panels update automatically. No per-component wiring needed.

```ts
registerCameraProperties(camera, orbitControls);
registerLightProperties(ambientLight, directionalLight);
```

The global `globalSceneSchema` (frame rate, text selection, bloom, vignette) is always present in every view's Config panel without any per-view registration.
