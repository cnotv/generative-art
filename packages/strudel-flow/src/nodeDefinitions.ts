import type { StrudelFlowNodeDefinition, StrudelFlowNodeKind } from './types'

/** Every node the flow palette offers, in the order it lists them. */
export const STRUDEL_FLOW_NODE_DEFINITIONS: StrudelFlowNodeDefinition[] = [
  {
    kind: 'pad',
    title: 'Pad',
    category: 'Instruments',
    description: 'An eight-step note grid on a key and scale.'
  },
  {
    kind: 'beats',
    title: 'Beats',
    category: 'Instruments',
    description: 'Drum tracks of any sample, such as cp or 808bd, on a step grid.'
  },
  {
    kind: 'chords',
    title: 'Chords',
    category: 'Instruments',
    description: 'A chord progression with editable scale degrees.'
  },
  {
    kind: 'notes',
    title: 'Notes',
    category: 'Instruments',
    description: 'A note line in mini notation, such as c3 [e3 g3].'
  },
  {
    kind: 'samples',
    title: 'Samples',
    category: 'Instruments',
    description: 'A sample line in mini notation, such as bd*2 sd.'
  },
  {
    kind: 'code',
    title: 'Code',
    category: 'Instruments',
    description: 'One custom Strudel expression.'
  },
  {
    kind: 'voice',
    title: 'Voice',
    category: 'Sounds',
    description: 'The synth or sample bank that plays the notes.'
  },
  {
    kind: 'filter',
    title: 'Filter',
    category: 'Effects',
    description: 'A low-pass filter and its resonance.'
  },
  {
    kind: 'delay',
    title: 'Delay',
    category: 'Effects',
    description: 'A feedback delay with mix and time.'
  },
  {
    kind: 'space',
    title: 'Space',
    category: 'Effects',
    description: 'A room reverb with size, fade and damping.'
  },
  {
    kind: 'level',
    title: 'Level',
    category: 'Effects',
    description: 'Gain, stereo pan and postgain.'
  },
  {
    kind: 'envelope',
    title: 'Envelope',
    category: 'Effects',
    description: 'An attack, decay, sustain and release shape.'
  },
  {
    kind: 'scope',
    title: 'Scope',
    category: 'Effects',
    description: 'A waveform scope with a zoom scale.'
  },
  {
    kind: 'effect',
    title: 'Effect',
    category: 'Effects',
    description: 'Any other Strudel call, such as fast(2) or jux(rev).'
  }
]

/**
 * The definition the palette and a node's header read their title from.
 * @param kind - the node kind
 * @returns the matching definition
 */
export const getStrudelFlowNodeDefinition = (
  kind: StrudelFlowNodeKind
): StrudelFlowNodeDefinition =>
  STRUDEL_FLOW_NODE_DEFINITIONS.find((definition) => definition.kind === kind) ??
  STRUDEL_FLOW_NODE_DEFINITIONS[0]
