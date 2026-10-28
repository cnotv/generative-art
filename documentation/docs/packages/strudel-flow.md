---
sidebar_position: 16
---

# Package: @webgamekit/strudel-flow

A node editor that compiles a patch of instrument and effect nodes into Strudel code. It powers the **Flow** tab of the Strudel editor at `/tools/StrudelEditor` and follows [Strudel Flow](https://xyflow.com/strudel-flow) by [xyflow](https://xyflow.com), the makers of React Flow.

![The starter patch in dark mode: a Pad played by a Voice through a Filter, with the tempo bar above](/img/strudel-flow/flow-editor-dark.webp)

<video controls muted loop playsinline width="100%">
  <source src="/video/strudel-flow/flow-editor.webm" type="video/webm" />
  Typing a stacked pattern in the code editor, switching to Flow to see it as Notes, Voice, Samples, Space and Effect nodes, adding a Delay from the radial menu, and switching back to the code it wrote.
</video>

![The same patch in light mode: white cards on a pale canvas](/img/strudel-flow/flow-editor-light.webp)

![The radial add menu over the canvas, with Instruments, Effects and Sounds around a close button](/img/strudel-flow/flow-radial.webp)

## Installation

```bash
pnpm add @webgamekit/strudel-flow
```

## What it does

A patch is a set of nodes and cables, a tempo, the beats in one cycle, and setup lines. Instruments start a pattern; effects and sounds transform an incoming one. The package compiles each connected component into one `$:` block. Every instrument passes only through the effects downstream of it: the effects all of them share chain once after a `stack(...)`, and an effect one instrument alone reaches stays on that branch. A fully muted component is written as `_$:`. The program starts with `setcpm(<bpm>/<beats per cycle>)`, then the setup lines.

```typescript
import { compileStrudelFlow, type StrudelFlowPatch } from '@webgamekit/strudel-flow'

const patch: StrudelFlowPatch = {
  nodes: [...],
  edges: [...],
  beatsPerMinute: 120,
  beatsPerCycle: 4,
  setup: ''
}

const { code, errorMessage } = compileStrudelFlow(patch)
// code: "setcpm(120/4)\n$: ..."
```

## Nodes

| Kind       | Category   | What it does                                                                                                                   |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Pad        | Instrument | An eight-note grid with an arpeggio or chord mode, key, scale and octave                                                       |
| Beats      | Instrument | Up to eight tracks of any sample, a step count, and per-step variations                                                        |
| Chords     | Instrument | A four-chord progression with preset shapes and note-level editing                                                             |
| Notes      | Instrument | A `note("…")` line in mini notation                                                                                            |
| Samples    | Instrument | An `s("…")` line in mini notation                                                                                              |
| Code       | Instrument | One custom Strudel expression                                                                                                  |
| Filter     | Effect     | A low-pass filter (`lpf`) and resonance (`lpq`)                                                                                |
| Delay      | Effect     | Mix, time and feedback                                                                                                         |
| Space      | Effect     | Room, size, fade, low-pass and dim (`room` … `roomdim`)                                                                        |
| Level      | Effect     | Gain, stereo pan and postgain                                                                                                  |
| Envelope   | Effect     | Attack, decay, sustain and release                                                                                             |
| Visualizer | Effect     | One of Strudel's visuals (pianoroll, punchcard, scope, spiral, pitch wheel, spectrum), inline or behind the code, with options |
| Effect     | Effect     | Chained calls with no single node to sit on, such as the ones after a whole `stack(...)`                                       |
| Voice      | Sound      | The synth or sample bank, as `sound("…")`                                                                                      |

Every instrument can be muted from its header, which writes `.hush()`. The header's **…** menu shows the code the node writes, adds a call and removes the node.

Every node's data takes an optional `calls` list of `{ method, argument }`, chained after the node's own pattern as `.method(argument)`. Parsing puts any call without a dedicated node there, on the node it follows in the code, so `.mask("<1 0>")` or `.lpf(sine.range(300, 3000))` never becomes a node of its own. The node shows the list under **Calls**: a call named in `STRUDEL_FLOW_CALL_PARAMETERS` gets sliders, text fields or on and off steps (`readStrudelFlowCallFields` and `writeStrudelFlowCallFields` convert its argument), and any other call stays as text to edit in place. Calls after a Visualizer start an Effect node, since a visual only draws the pattern.

A Visualizer node is its visual, a type list and an under-the-line or behind-the-code toggle. Strudel paints the visual on a canvas in the code editor, and the node copies it each frame: `getStrudelFlowVisualizerWidgetIds(nodes, edges)` names that canvas for every inline Visualizer node, the way Strudel numbers its widgets, and a behind-the-code one copies `STRUDEL_FLOW_BACKGROUND_CANVAS_ID`, which the host page must keep sized while the flow hides it.

Add a node with the **+** button or by right-clicking the canvas; both open the same radial menu, split into Instruments, Effects and Sounds. `StrudelFlowEditor` also draws the tempo bar, taking `beatsPerMinute` and `beatsPerCycle` and emitting their updates. An optional `sampleGroups` prop, a list of `StrudelFlowSampleGroup` (`{ label, samples }`, each sample a `StrudelFlowSampleOption` of `{ value, label }`), hands the host's sample library to the Samples node, whose **Add sample** picker appends the chosen `value` to its pattern, and to each Beats track's picker after its drum shortlist. The `label` is what the pickers show, so a host can offer "Bass drum" under "Roland TR909" while the pattern gets `rolandtr909_bd`. Cables only run from an instrument or effect output into an effect input. Self-connections, duplicates, cycles and cables into an instrument are rejected.

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

`useStrudelFlow()` holds the patch state, compiles it on every change, persists it to local storage, and offers `addNode`, `updateNodeData`, `removeNode`, `connectNodes`, `setBeatsPerMinute`, `setBeatsPerCycle`, `resetPatch` and `loadCode`.

## Code round trip

The flow editor is not a separate format: any code maps onto a graph. `parseStrudelFlowCode(code, existingNodes)` reads it block by block. Calls with a dedicated node get it, any other chained call becomes an Effect node, a flat sample line such as `s("~ cp ~ cp")` becomes Beats tracks, `note("…")` becomes Notes, richer sample lines become Samples, `stack(...)` splits into its instruments with their own branch effects, and a head nothing reads becomes a Code node. Statements that are not patterns, such as `samples(...)` or `const cc = await midin(...)`, go to `setup`. It returns `null` while the code has a syntax error, and `loadCode` then leaves the graph alone and returns `false`.

```typescript
import { useStrudelFlow } from '@webgamekit/strudel-flow'

const flow = useStrudelFlow()
flow.loadCode('$: note("c3 e3").sound("sawtooth").lpf(800).fast(2)')
// flow.nodes now holds Notes, Voice, Filter and an Effect node for fast(2)
```

The app parses the code whenever typing pauses, and compiles the graph back into the editor after a canvas edit. The hook itself never touches the DOM or the player.

## Credits

The node set, the controls, the radial menu, the tempo bar and the visual language all follow [Strudel Flow](https://xyflow.com/strudel-flow) by [xyflow](https://xyflow.com), a visual music sequencer built with React Flow and Strudel. Its source is [xyflow/strudel-flow](https://github.com/xyflow/strudel-flow), licensed AGPL-3.0. This package rebuilds it in Vue for this repo's editor, and it plays through the Strudel engine, itself AGPL-3.0-or-later.

`STRUDEL_FLOW_REFERENCE` in the package config holds those links, and `StrudelFlowEditor` shows a credit in the corner of the canvas that links to them; the Strudel editor's flow and welcome tabs credit it too.

## Export

The package's barrel (`src/index.ts`) re-exports the types, the compiler, the connection rules, storage parsing, the default patch, the state hook and every Vue component. It is private to this repo and bundled by the application, so consumers import it through the workspace alias `@webgamekit/strudel-flow`.
