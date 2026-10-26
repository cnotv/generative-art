---
sidebar_position: 16
---

# Package: @webgamekit/strudel-flow

A node editor that compiles a patch of instrument and effect nodes into Strudel code. It powers the **Flow** tab of the Strudel editor at `/tools/StrudelEditor` and is inspired by [Strudel Flow by xyflow](https://xyflow.com/strudel-flow).

![The flow editor in dark mode: a Pad node connected to a Filter node, with the node palette on the right](/img/strudel-flow/flow-editor-dark.webp)

<video controls muted loop playsinline width="100%">
  <source src="/video/strudel-flow/flow-editor.webm" type="video/webm" />
  Adding a Beats node from the palette and turning on steps in its sixteen-step grid.
</video>

![The same patch in light mode: white cards on a pale canvas](/img/strudel-flow/flow-editor-light.webp)

## Installation

```bash
pnpm add @webgamekit/strudel-flow
```

## What it does

A patch is a set of nodes and cables plus a tempo. Instruments (Pad, Beats, Chords, Code) start a pattern; effects (Filter, Delay, Space) transform an incoming pattern. The package compiles each connected component into one `$:` block — instruments stack, effects chain in signal order — and prefixes it with `setcpm(<bpm>/4)`.

```typescript
import { compileStrudelFlow, type StrudelFlowPatch } from '@webgamekit/strudel-flow'

const patch: StrudelFlowPatch = {
  nodes: [...],
  edges: [...],
  beatsPerMinute: 120
}

const { code, errorMessage } = compileStrudelFlow(patch)
// code: "setcpm(120/4)\n$: ..."
```

## Nodes

| Kind   | Category   | What it does                                    |
| ------ | ---------- | ----------------------------------------------- |
| Pad    | Instrument | A melodic phrase: notes and a synth             |
| Beats  | Instrument | A sixteen-step kick, snare and hi-hat grid      |
| Chords | Instrument | A chord voicing on a root and chord type        |
| Code   | Instrument | One custom Strudel expression                   |
| Filter | Effect     | A low-pass filter (`lpf`) and resonance (`lpq`) |
| Delay  | Effect     | Mix, time and feedback                          |
| Space  | Effect     | Room reverb and room size                       |

Cables only run from an instrument or effect output into an effect input. Self-connections, duplicates, cycles and cables into an instrument are rejected.

## Editor component

```vue
<script setup lang="ts">
import { StrudelFlowEditor, useStrudelFlow } from '@webgamekit/strudel-flow'
import { ref } from 'vue'

const { nodes, edges, beatsPerMinute, compilation } = useStrudelFlow()
</script>

<template>
  <StrudelFlowEditor
    :nodes="nodes"
    :edges="edges"
    @update:nodes="nodes = $event"
    @update:edges="edges = $event"
  />
</template>
```

`useStrudelFlow()` holds the patch state, compiles it on every change, persists it to local storage, and offers `addNode`, `updateNodeData`, `removeNode`, `connectNodes`, `setBeatsPerMinute` and `resetPatch`.

## Export

The package's barrel (`src/index.ts`) re-exports the types, the compiler, the connection rules, storage parsing, the default patch, the state hook and every Vue component. It is private to this repo and bundled by the application, so consumers import it through the workspace alias `@webgamekit/strudel-flow`.
