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

| Kind       | Category   | What it does                                                                                                                                                          |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pad        | Instrument | An eight-note grid with an arpeggio or chord mode, key, scale and octave                                                                                              |
| Beats      | Instrument | Up to eight tracks of any sample, a step count, and per-step variations                                                                                               |
| Chords     | Instrument | A four-chord progression with preset shapes and note-level editing; `chord("<C Am F G>")` of plain triads in one key reads as Chords and writes back as chord symbols |
| Notes      | Instrument | A `note("…")` line in mini notation, drawn as a guitar or bass tab, piano sheet music, a piano roll or note names                                                     |
| Samples    | Instrument | An `s("…")` line edited as steps, rests, groups and layers                                                                                                            |
| Code       | Instrument | One custom Strudel expression                                                                                                                                         |
| Filter     | Effect     | A low-pass filter (`lpf`) and resonance (`lpq`)                                                                                                                       |
| Delay      | Effect     | Mix, time and feedback                                                                                                                                                |
| Space      | Effect     | Room, size, fade, low-pass and dim (`room` … `roomdim`)                                                                                                               |
| Gain       | Effect     | `gain`                                                                                                                                                                |
| Level      | Effect     | Stereo pan and postgain                                                                                                                                               |
| Mask       | Effect     | `mask(…)`, its argument kept as written; a plain run of ones and zeros shows as switches                                                                              |
| Struct     | Effect     | `struct(…)`, its argument kept as written; a plain run of `x` and `~` shows as switches with a step count                                                             |
| Slow       | Effect     | `slow(n)` with a knob; a slider or other expression stays an Effect node                                                                                              |
| Voicing    | Effect     | `voicing()` with no argument, which spreads chord symbols into played notes                                                                                           |
| Envelope   | Effect     | Attack, decay, sustain and release                                                                                                                                    |
| Visualizer | Effect     | One of Strudel's visuals (pianoroll, punchcard, scope, spiral, pitch wheel, spectrum), inline or behind the code, with options                                        |
| Effect     | Effect     | One chained call no other node covers, such as `.jux(rev)`                                                                                                            |
| Voice      | Sound      | The synth or sample bank, as `sound("…")`                                                                                                                             |

Every instrument can be muted from its header, which writes `.hush()`. The header's **…** menu shows the code the node writes, emits `show-code` with the node id for **Go to code**, and removes the node. `findStrudelFlowNodeCode(code, nodes, edges, nodeId)` returns the `{ from, to }` range of that node's call in the program, counting calls of the same name in the order `getStrudelFlowCodeOrder(nodes, edges)` gives, so a host can select it. Each cable carries a disconnect button that removes it through Vue Flow, which emits `update:edges`.

Only an Effect node holds calls: its data is a `calls` list of `{ method, argument }`, chained after its input as `.method(argument)`. No other node takes calls, and a stored patch that gave one some drops them, since the graph is rebuilt from code. Parsing gives any call without a dedicated node, such as `.jux(rev)` or `.lpf(sine.range(300, 3000))`, an Effect node of its own, `.mask(…)` and `.struct(…)` always become Mask and Struct nodes, `.slow(n)` with a number becomes a Slow node, and `.voicing()` a Voicing node. The Effect node shows its call under **Calls**: a call named in `STRUDEL_FLOW_CALL_PARAMETERS` gets knobs, text fields or on and off steps (`readStrudelFlowCallFields` and `writeStrudelFlowCallFields` convert its argument), and any other call stays as text to edit in place.

A Visualizer node is its visual, a type list and an under-the-line or behind-the-code toggle. Strudel paints the visual on a canvas in the code editor, and the node copies it each frame: `getStrudelFlowVisualizerWidgetIds(nodes, edges)` names that canvas for every inline Visualizer node, the way Strudel numbers its widgets, and a behind-the-code one copies `STRUDEL_FLOW_BACKGROUND_CANVAS_ID` onto a layer behind the whole node, stretched to its width and height. The host page must keep that canvas sized while the flow hides it.

A Notes node's data carries a `notation`: `auto`, `guitar`, `bass`, `sheet`, `piano`, `names` or `text` (`StrudelFlowNotation`), and an optional `showPattern`. The text box is hidden while a notation is drawn, unless `showPattern` is true or the notation is `text`, which shows the text alone. A patch stored before the field existed reads it as `auto`, and rebuilding the graph from code keeps it on the node it reuses. Auto is `pickStrudelFlowNotation(sound)` on the sound from `findStrudelFlowNotesSound(nodeId, nodes, edges)`, the first Voice node the node's cables reach or else an `.s()` call on the node; the words it matches are `STRUDEL_FLOW_NOTATION_BY_SOUND`. To draw anything the editor needs the optional `noteReader` prop, a `StrudelFlowNoteReader` that turns a pattern and the beats per cycle into bars of `{ notes, start, beats }`. The package does not load Strudel, so the host supplies it, as the playground does with Strudel's own mini notation parser. Without it a Notes node shows only its text.

The views are components of their own: `StrudelFlowTabStaff` (`bars`, `instrument`, `beatsPerBar`), `StrudelFlowSheet` (`bars`, `beatsPerBar`), `StrudelFlowPianoRoll` (`bars`, `beatsPerBar`) and `StrudelFlowNoteNames` (`bars`, `beatsPerBar`); the bar length lets each show the rest that closes a bar which stops early. The tab's marks come from `layoutStrudelFlowTab(bars, instrument, beatsPerBar)`, which places frets with `placeStrudelFlowFrets(chords, openStrings)` on the tunings in `STRUDEL_FLOW_OPEN_STRINGS`, the sheet's from `layoutStrudelFlowSheet(bars, beatsPerBar)`, and `readStrudelFlowSpelledNote`, `readStrudelFlowMidiNote` and `formatStrudelFlowBeats` read a note value and write a length. Why the tab is drawn as it is: [Drawing a Notes node as a tab](../journey/strudel-notes-notation.md).

![A Notes node drawing an imported bass line as a tab](/img/strudel-flow/notes-bass-tab-dark.webp)

Add a node with the **+** button or by right-clicking the canvas; both open the same radial menu, split into Instruments, Effects and Sounds. `StrudelFlowEditor` also draws the tempo bar, taking `beatsPerMinute` and `beatsPerCycle` and emitting their updates. An optional `sampleGroups` prop, a list of `StrudelFlowSampleGroup` (`{ label, samples }`, each sample a `StrudelFlowSampleOption` of `{ value, label }`), hands the host's sample library to the Samples node's step pickers and to each Beats track's picker after its drum shortlist. On a fine pointer a picker opens a searchable panel sorted into the instrument families of `STRUDEL_FLOW_SAMPLE_FAMILIES` by `findStrudelFlowSampleFamily(name)`, drawn into the editor shell so the canvas zoom cannot misplace it; a coarse pointer gets the native select. A Samples node reads its pattern with `parseStrudelFlowSampleLayers(pattern)` into layers of `StrudelFlowSampleStep` (rest, sound with modifier, `[…]` or `<…>` group, or text for anything else) and writes it back with `writeStrudelFlowSampleLayers(layers)`. The `label` is what the pickers show, so a host can offer "Bass drum" under "Roland TR909" while the pattern gets `rolandtr909_bd`. A second optional prop, `voiceGroups`, takes the same shape for the host's synths and instruments, and fills the Voice node's list under their headings after its four waveforms; a sound the code already names stays selectable even when the host lists nothing. Cables only run from an instrument or effect output into an effect input. Self-connections, duplicates, cycles and cables into an instrument are rejected.

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

The flow editor is not a separate format: any code maps onto a graph. `parseStrudelFlowCode(code, existingNodes)` reads it block by block. Calls with a dedicated node get it, any other chained call becomes an Effect node, a flat sample line such as `s("~ cp ~ cp")` becomes Beats tracks, `note("…")` and `chord("…")` become Notes (a chord line carries `head: 'chord'` and shows only as names or mini notation), `note(name)` and `chord(name)` of a constant declared in the setup become the same node with the constant inlined, an `arrange(...)` unrolled one bar per cycle, richer sample lines become Samples, `stack(...)` splits into its instruments with their own branch effects, and a head nothing reads becomes a Code node. Statements that are not patterns, such as `samples(...)` or `const cc = await midin(...)`, go to `setup`. It returns `null` while the code has a syntax error, and `loadCode` then leaves the graph alone and returns `false`.

`appendStrudelFlowBlocks(code, blocks)` appends `$:` blocks to a program so they play alongside it. Strudel stops playing an unlabelled last expression once any labelled block exists, so that expression gets `$:` in front of it first; code that already has labelled blocks, or plays no pattern, is only appended to.

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
