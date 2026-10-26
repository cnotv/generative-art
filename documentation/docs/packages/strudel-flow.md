---
sidebar_position: 16
---

# Package: @webgamekit/strudel-flow

A node editor that compiles a patch of instrument and effect nodes into Strudel code. It powers the **Flow** tab of the Strudel editor at `/tools/StrudelEditor` and is inspired by [Strudel Flow by xyflow](https://xyflow.com/strudel-flow).

![The flow editor in dark mode: Pad and Chords nodes, a Space node and a Scope node, with the palette on the right](/img/strudel-flow/flow-editor-dark.webp)

<video controls muted loop playsinline width="100%">
  <source src="/video/strudel-flow/flow-editor.webm" type="video/webm" />
  Adding a Level node from the radial menu, changing the pad pattern, and checking the code it writes.
</video>

![The same patch in light mode: white cards on a pale canvas](/img/strudel-flow/flow-editor-light.webp)

![The radial add menu over the canvas, with Instruments and Effects around a close button](/img/strudel-flow/flow-radial.webp)

## Installation

```bash
pnpm add @webgamekit/strudel-flow
```

## What it does

A patch is a set of nodes and cables plus a tempo. Instruments (Pad, Beats, Chords, Code) start a pattern; effects (Filter, Delay, Space, Level, Envelope, Scope) transform an incoming pattern. The package compiles each connected component into one `$:` block — instruments stack, effects chain in signal order — and prefixes it with `setcpm(<bpm>/4)`.

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

| Kind     | Category   | What it does                                                             |
| -------- | ---------- | ------------------------------------------------------------------------ |
| Pad      | Instrument | An eight-note grid with an arpeggio or chord mode, key, scale and octave |
| Beats    | Instrument | A sixteen-step kick, snare and hi-hat grid                               |
| Chords   | Instrument | A four-chord progression with preset shapes and note-level editing       |
| Code     | Instrument | One custom Strudel expression                                            |
| Filter   | Effect     | A low-pass filter (`lpf`) and resonance (`lpq`)                          |
| Delay    | Effect     | Mix, time and feedback                                                   |
| Space    | Effect     | Room, size, fade, low-pass and dim (`room` … `roomdim`)                  |
| Level    | Effect     | Gain, stereo pan and postgain                                            |
| Envelope | Effect     | Attack, decay, sustain and release                                       |
| Scope    | Effect     | A waveform display scaled by `analyze("flow-scope")` and a scale control |

Add a node with the **+** button or by right-clicking the canvas; both open the same radial menu, split into Instruments and Effects. Cables only run from an instrument or effect output into an effect input. Self-connections, duplicates, cycles and cables into an instrument are rejected.

## Editor component

```vue
<script setup lang="ts">
import { StrudelFlowEditor, useStrudelFlow } from '@webgamekit/strudel-flow'

const { nodes, edges, beatsPerMinute, compilation, addNode, connectNodes } = useStrudelFlow()
</script>

<template>
  <StrudelFlowEditor
    v-model:nodes="nodes"
    v-model:edges="edges"
    @add-node="addNode"
    @connect="connectNodes"
  />
</template>
```

`useStrudelFlow()` holds the patch state, compiles it on every change, persists it to local storage, and offers `addNode`, `updateNodeData`, `removeNode`, `connectNodes`, `setBeatsPerMinute`, `resetPatch` and `loadCode`.

## Code round trip

The flow editor is not a separate format. `parseStrudelFlowCode(code, existingNodes)` turns the code the editor writes back into nodes: pad and chord patterns, drum rows, tempo and the six known effects keep their controls, while anything it cannot map becomes a Code node so the sound is never lost. The app calls it on every code edit, hint and loaded pattern, so the graph follows the code in both directions:

```typescript
import { parseStrudelFlowCode, useStrudelFlow } from '@webgamekit/strudel-flow'

const flow = useStrudelFlow()
flow.loadCode('$: n("[0 2] [4]").scale("C3:major").sound("triangle")')
// flow.nodes now holds a Pad node
```

When a node changes, the app compiles the patch and writes the result into the editor; an invalid patch leaves the last playable code in place and reports the error under the canvas. The hook itself never touches the DOM or the player.

## Export

The package's barrel (`src/index.ts`) re-exports the types, the compiler, the connection rules, storage parsing, the default patch, the state hook and every Vue component. It is private to this repo and bundled by the application, so consumers import it through the workspace alias `@webgamekit/strudel-flow`.
