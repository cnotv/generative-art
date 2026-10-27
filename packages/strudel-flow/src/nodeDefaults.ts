import {
  STRUDEL_FLOW_DEFAULT_BEATS_STEPS,
  STRUDEL_FLOW_DRUM_ROWS,
  STRUDEL_FLOW_MAX_SCOPE_SCALE,
  STRUDEL_FLOW_MIN_SCOPE_SCALE,
  STRUDEL_FLOW_PAD_NOTE_COUNT,
  STRUDEL_FLOW_PAD_STEP_COUNT,
  STRUDEL_FLOW_STEP_COUNT
} from './config'
import type {
  StrudelFlowChordsData,
  StrudelFlowCodeData,
  StrudelFlowDelayData,
  StrudelFlowDrumRow,
  StrudelFlowEffectData,
  StrudelFlowEnvelopeData,
  StrudelFlowFilterData,
  StrudelFlowLevelData,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowNotesData,
  StrudelFlowPadData,
  StrudelFlowSamplesData,
  StrudelFlowScopeData,
  StrudelFlowSpaceData,
  StrudelFlowVoiceData
} from './types'

const INSTRUMENT_KINDS: StrudelFlowNodeKind[] = [
  'pad',
  'beats',
  'chords',
  'notes',
  'samples',
  'code'
]

/** The pad pattern the node opens with: an arpeggio rising and falling over eight steps. */
const STARTER_PAD_NOTES: [step: number, note: number][] = [
  [0, 7],
  [1, 5],
  [2, 3],
  [3, 1],
  [4, 3],
  [5, 2],
  [6, 6],
  [7, 3]
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
  steps: 8,
  mode: 'arp',
  octave: 3,
  key: 'C',
  scaleType: 'major',
  grid: createDefaultPadGrid(),
  columnModifiers: {}
}

export const STRUDEL_FLOW_CHORDS_DEFAULTS: StrudelFlowChordsData = {
  kind: 'chords',
  key: 'C',
  octave: 4,
  scaleType: 'major',
  chordProgression: [0, 5, 3, 4]
}

export const STRUDEL_FLOW_NOTES_DEFAULTS: StrudelFlowNotesData = {
  kind: 'notes',
  pattern: 'c3 [e3 g3] a3 [g3 e3]'
}

export const STRUDEL_FLOW_SAMPLES_DEFAULTS: StrudelFlowSamplesData = {
  kind: 'samples',
  pattern: 'bd*2 [~ sd] bd sd'
}

export const STRUDEL_FLOW_CODE_DEFAULTS: StrudelFlowCodeData = {
  kind: 'code',
  code: 'n("<[0,2,4,6] [5,7,9,11]>").scale("C3:major").slow(2)'
}

export const STRUDEL_FLOW_VOICE_DEFAULTS: StrudelFlowVoiceData = {
  kind: 'voice',
  sound: 'triangle'
}

export const STRUDEL_FLOW_EFFECT_DEFAULTS: StrudelFlowEffectData = {
  kind: 'effect',
  method: 'fast',
  argument: '2'
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
 * A silent Beats track for one sample.
 * @param sound - the sample name, such as "cp"
 * @param hits - the steps that play, none by default
 * @returns a track with all sixteen steps and no variations
 */
export const createStrudelFlowDrumRow = (
  sound: string,
  hits: number[] = []
): StrudelFlowDrumRow => ({
  sound,
  steps: Array.from({ length: STRUDEL_FLOW_STEP_COUNT }, (_, step) => hits.includes(step)),
  modifiers: {}
})

/**
 * Copies the starter drum grid so two Beats nodes never share the same step arrays.
 * @returns a fresh set of drum rows with all sixteen steps
 */
export const createDefaultDrumRows = (): StrudelFlowDrumRow[] =>
  STRUDEL_FLOW_DRUM_ROWS.map((row) => createStrudelFlowDrumRow(row.sound, row.hits))

const NODE_DATA_FACTORIES: { [Kind in StrudelFlowNodeKind]: () => StrudelFlowNodeData } = {
  pad: () => ({ ...STRUDEL_FLOW_PAD_DEFAULTS, grid: createDefaultPadGrid(), columnModifiers: {} }),
  beats: () => ({
    kind: 'beats',
    steps: STRUDEL_FLOW_DEFAULT_BEATS_STEPS,
    rows: createDefaultDrumRows(),
    showModifiers: false
  }),
  chords: () => ({ ...STRUDEL_FLOW_CHORDS_DEFAULTS, chordProgression: [0, 5, 3, 4] }),
  notes: () => ({ ...STRUDEL_FLOW_NOTES_DEFAULTS }),
  samples: () => ({ ...STRUDEL_FLOW_SAMPLES_DEFAULTS }),
  code: () => ({ ...STRUDEL_FLOW_CODE_DEFAULTS }),
  voice: () => ({ ...STRUDEL_FLOW_VOICE_DEFAULTS }),
  filter: () => ({ ...STRUDEL_FLOW_FILTER_DEFAULTS }),
  delay: () => ({ ...STRUDEL_FLOW_DELAY_DEFAULTS }),
  space: () => ({ ...STRUDEL_FLOW_SPACE_DEFAULTS }),
  level: () => ({ ...STRUDEL_FLOW_LEVEL_DEFAULTS }),
  envelope: () => ({ ...STRUDEL_FLOW_ENVELOPE_DEFAULTS }),
  scope: () => ({ ...STRUDEL_FLOW_SCOPE_DEFAULTS }),
  effect: () => ({ ...STRUDEL_FLOW_EFFECT_DEFAULTS })
}

/**
 * The settings a node of this kind starts with.
 * @param kind - the node kind
 * @returns fresh node data, including arrays that are safe to edit in place
 */
export const createStrudelFlowNodeData = (kind: StrudelFlowNodeKind): StrudelFlowNodeData =>
  NODE_DATA_FACTORIES[kind]()

/**
 * Whether a node kind starts a pattern rather than transforming one.
 * @param kind - the node kind
 * @returns true for an instrument
 */
export const isStrudelFlowInstrumentKind = (kind: StrudelFlowNodeKind): boolean =>
  INSTRUMENT_KINDS.includes(kind)

/**
 * Whether a node kind transforms an incoming pattern. Sounds count: a voice reshapes the notes
 * it is given rather than starting a pattern.
 * @param kind - the node kind
 * @returns true for an effect or a sound
 */
export const isStrudelFlowEffectKind = (kind: StrudelFlowNodeKind): boolean =>
  !INSTRUMENT_KINDS.includes(kind)

/**
 * The scope scale clamped to the range its knob can draw.
 * @param data - the scope node's settings
 * @returns the scale between the configured minimum and maximum
 */
export const getStrudelFlowScopeScale = (data: StrudelFlowScopeData): number =>
  Math.min(STRUDEL_FLOW_MAX_SCOPE_SCALE, Math.max(STRUDEL_FLOW_MIN_SCOPE_SCALE, data.scale))
