import {
  STRUDEL_FLOW_DRUM_ROWS,
  STRUDEL_FLOW_MAX_SCOPE_SCALE,
  STRUDEL_FLOW_MIN_SCOPE_SCALE,
  STRUDEL_FLOW_PAD_NOTE_COUNT,
  STRUDEL_FLOW_PAD_STEP_COUNT
} from './config'
import type {
  StrudelFlowChordsData,
  StrudelFlowCodeData,
  StrudelFlowDelayData,
  StrudelFlowDrumInstrument,
  StrudelFlowDrumRow,
  StrudelFlowEnvelopeData,
  StrudelFlowFilterData,
  StrudelFlowLevelData,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowPadData,
  StrudelFlowScopeData,
  StrudelFlowSpaceData
} from './types'

const INSTRUMENT_KINDS: StrudelFlowNodeKind[] = ['pad', 'beats', 'chords', 'code']
const EFFECT_KINDS: StrudelFlowNodeKind[] = [
  'filter',
  'delay',
  'space',
  'level',
  'envelope',
  'scope'
]

/** A label shown on a drum row and in the step grid, by its Strudel sound name. */
export const STRUDEL_FLOW_DRUM_LABELS: Record<StrudelFlowDrumRow['instrument'], string> = {
  bd: 'Kick',
  sd: 'Snare',
  hh: 'Hi-hat'
}

/** The pad pattern the node opens with: a rising arpeggio over five steps. */
const STARTER_PAD_NOTES: [step: number, note: number][] = [
  [0, 0],
  [0, 4],
  [1, 2],
  [2, 4],
  [3, 2],
  [4, 0]
]
const STARTER_PAD_CELLS = new Set(STARTER_PAD_NOTES.map(([step, note]) => `${step}:${note}`))

/**
 * A fresh pad grid, wide enough for the full sixteen steps.
 * @returns sixteen rows of eight cells with the starter arpeggio on
 */
export const createDefaultPadGrid = (): boolean[][] =>
  Array.from({ length: STRUDEL_FLOW_PAD_STEP_COUNT }, (_, step) =>
    Array.from({ length: STRUDEL_FLOW_PAD_NOTE_COUNT }, (_, note) =>
      STARTER_PAD_CELLS.has(`${step}:${note}`)
    )
  )

export const STRUDEL_FLOW_PAD_DEFAULTS: StrudelFlowPadData = {
  kind: 'pad',
  steps: 5,
  mode: 'arp',
  octave: 3,
  key: 'C',
  scaleType: 'major',
  grid: createDefaultPadGrid(),
  columnModifiers: {},
  sound: 'triangle'
}

export const STRUDEL_FLOW_CHORDS_DEFAULTS: StrudelFlowChordsData = {
  kind: 'chords',
  key: 'C',
  octave: 4,
  scaleType: 'major',
  chordProgression: [0, 5, 3, 4],
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
  roomSize: 2,
  roomFade: 0.5,
  roomLowPass: 10000,
  roomDim: 8000
}

export const STRUDEL_FLOW_LEVEL_DEFAULTS: StrudelFlowLevelData = {
  kind: 'level',
  gain: 1,
  pan: 0.5,
  postgain: 1
}

export const STRUDEL_FLOW_ENVELOPE_DEFAULTS: StrudelFlowEnvelopeData = {
  kind: 'envelope',
  attack: 0.1,
  decay: 0.1,
  sustain: 0.7,
  release: 0.2
}

export const STRUDEL_FLOW_SCOPE_DEFAULTS: StrudelFlowScopeData = {
  kind: 'scope',
  scale: 0.25
}

/**
 * Copies the starter drum grid so two Beats nodes never share the same step arrays.
 * @returns a fresh set of drum rows with all sixteen steps
 */
export const createDefaultDrumRows = (): StrudelFlowDrumRow[] =>
  STRUDEL_FLOW_DRUM_ROWS.map((row) => ({
    instrument: row.instrument as StrudelFlowDrumInstrument,
    steps: [...row.steps]
  }))

/**
 * The settings a node of this kind starts with.
 * @param kind - the node kind
 * @returns fresh node data, including arrays that are safe to edit in place
 */
// The switch is one branch per node kind; splitting it would only hide that shape.
// eslint-disable-next-line complexity
export const createStrudelFlowNodeData = (kind: StrudelFlowNodeKind): StrudelFlowNodeData => {
  switch (kind) {
    case 'pad':
      return {
        ...STRUDEL_FLOW_PAD_DEFAULTS,
        grid: createDefaultPadGrid(),
        columnModifiers: {}
      }
    case 'beats':
      return { kind, rows: createDefaultDrumRows() }
    case 'chords':
      return { ...STRUDEL_FLOW_CHORDS_DEFAULTS, chordProgression: [0, 5, 3, 4] }
    case 'code':
      return { ...STRUDEL_FLOW_CODE_DEFAULTS }
    case 'filter':
      return { ...STRUDEL_FLOW_FILTER_DEFAULTS }
    case 'delay':
      return { ...STRUDEL_FLOW_DELAY_DEFAULTS }
    case 'space':
      return { ...STRUDEL_FLOW_SPACE_DEFAULTS }
    case 'level':
      return { ...STRUDEL_FLOW_LEVEL_DEFAULTS }
    case 'envelope':
      return { ...STRUDEL_FLOW_ENVELOPE_DEFAULTS }
    case 'scope':
      return { ...STRUDEL_FLOW_SCOPE_DEFAULTS }
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
 * The scope scale clamped to the range its knob can draw.
 * @param data - the scope node's settings
 * @returns the scale between the configured minimum and maximum
 */
export const getStrudelFlowScopeScale = (data: StrudelFlowScopeData): number =>
  Math.min(STRUDEL_FLOW_MAX_SCOPE_SCALE, Math.max(STRUDEL_FLOW_MIN_SCOPE_SCALE, data.scale))
