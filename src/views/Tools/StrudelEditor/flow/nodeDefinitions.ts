import type { StrudelFlowNodeDefinition, StrudelFlowNodeKind } from './types'

/** Every node the flow palette offers, in the order it lists them. */
export const STRUDEL_FLOW_NODE_DEFINITIONS: StrudelFlowNodeDefinition[] = [
  {
    kind: 'pad',
    title: 'Pad',
    category: 'Instruments',
    description: 'A melodic phrase with its own synth.'
  },
  {
    kind: 'beats',
    title: 'Beats',
    category: 'Instruments',
    description: 'A sixteen-step kick, snare and hi-hat grid.'
  },
  {
    kind: 'chords',
    title: 'Chords',
    category: 'Instruments',
    description: 'A chord voicing on a root and chord type.'
  },
  {
    kind: 'code',
    title: 'Code',
    category: 'Instruments',
    description: 'One custom Strudel expression.'
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
    description: 'A room reverb and its size.'
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
