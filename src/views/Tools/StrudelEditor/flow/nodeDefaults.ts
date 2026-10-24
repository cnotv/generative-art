import { STRUDEL_FLOW_DRUM_ROWS } from './config'
import type {
  StrudelFlowChordsData,
  StrudelFlowCodeData,
  StrudelFlowDelayData,
  StrudelFlowDrumRow,
  StrudelFlowFilterData,
  StrudelFlowNodeCategory,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowPadData,
  StrudelFlowSpaceData
} from './types'

const INSTRUMENT_KINDS: StrudelFlowNodeKind[] = ['pad', 'beats', 'chords', 'code']
const EFFECT_KINDS: StrudelFlowNodeKind[] = ['filter', 'delay', 'space']

/** A label shown on a drum row and in the step grid, by its Strudel sound name. */
export const STRUDEL_FLOW_DRUM_LABELS: Record<StrudelFlowDrumRow['instrument'], string> = {
  bd: 'Kick',
  sd: 'Snare',
  hh: 'Hi-hat'
}

export const STRUDEL_FLOW_PAD_DEFAULTS: StrudelFlowPadData = {
  kind: 'pad',
  notes: '<c3 eb3 g3 bb3>',
  sound: 'triangle'
}

export const STRUDEL_FLOW_CHORDS_DEFAULTS: StrudelFlowChordsData = {
  kind: 'chords',
  root: 'C',
  chordType: '^7',
  sound: 'sawtooth'
}

export const STRUDEL_FLOW_CODE_DEFAULTS: StrudelFlowCodeData = {
  kind: 'code',
  code: 'n("<[0,2,4,6] [5,7,9,11]>").scale("C3:major").sound("triangle").slow(2)'
}

export const STRUDEL_FLOW_FILTER_DEFAULTS: StrudelFlowFilterData = {
  kind: 'filter',
  cutoff: 1500,
  resonance: 1
}

export const STRUDEL_FLOW_DELAY_DEFAULTS: StrudelFlowDelayData = {
  kind: 'delay',
  mix: 0.5,
  time: 0.25,
  feedback: 0.4
}

export const STRUDEL_FLOW_SPACE_DEFAULTS: StrudelFlowSpaceData = {
  kind: 'space',
  room: 0.4,
  roomSize: 2
}

/**
 * Copies the starter drum grid so two Beats nodes never share the same step arrays.
 * @returns a fresh set of drum rows with all sixteen steps
 */
export const createDefaultDrumRows = (): StrudelFlowDrumRow[] =>
  STRUDEL_FLOW_DRUM_ROWS.map((row) => ({
    instrument: row.instrument,
    steps: [...row.steps]
  }))

/**
 * The settings a node of this kind starts with.
 * @param kind - the node kind
 * @returns fresh node data, including arrays that are safe to edit in place
 */
export const createStrudelFlowNodeData = (kind: StrudelFlowNodeKind): StrudelFlowNodeData => {
  switch (kind) {
    case 'pad':
      return { ...STRUDEL_FLOW_PAD_DEFAULTS }
    case 'beats':
      return { kind, rows: createDefaultDrumRows() }
    case 'chords':
      return { ...STRUDEL_FLOW_CHORDS_DEFAULTS }
    case 'code':
      return { ...STRUDEL_FLOW_CODE_DEFAULTS }
    case 'filter':
      return { ...STRUDEL_FLOW_FILTER_DEFAULTS }
    case 'delay':
      return { ...STRUDEL_FLOW_DELAY_DEFAULTS }
    case 'space':
      return { ...STRUDEL_FLOW_SPACE_DEFAULTS }
    default:
      throw new Error(`Unsupported node kind: ${kind}`)
  }
}

/**
 * Whether a node kind starts a pattern rather than transforming one.
 * @param kind - the node kind
 * @returns true for an instrument
 */
export const isStrudelFlowInstrumentKind = (kind: StrudelFlowNodeKind): boolean =>
  INSTRUMENT_KINDS.includes(kind)

/**
 * Whether a node kind transforms an incoming pattern.
 * @param kind - the node kind
 * @returns true for an effect
 */
export const isStrudelFlowEffectKind = (kind: StrudelFlowNodeKind): boolean =>
  EFFECT_KINDS.includes(kind)

/**
 * The category a node kind belongs to in the palette and on its badge.
 * @param kind - the node kind
 * @returns the category name
 */
export const getStrudelFlowNodeCategory = (kind: StrudelFlowNodeKind): StrudelFlowNodeCategory =>
  isStrudelFlowInstrumentKind(kind) ? 'Instruments' : 'Effects'
