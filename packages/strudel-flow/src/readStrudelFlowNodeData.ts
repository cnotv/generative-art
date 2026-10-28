import {
  STRUDEL_FLOW_CHORD_SCALE_OPTIONS,
  STRUDEL_FLOW_DEFAULT_BEATS_STEPS,
  STRUDEL_FLOW_MAX_DRUM_ROWS,
  STRUDEL_FLOW_KEY_OPTIONS,
  STRUDEL_FLOW_MAX_FILTER_CUTOFF,
  STRUDEL_FLOW_MAX_FILTER_RESONANCE,
  STRUDEL_FLOW_MAX_ROOM_SIZE,
  STRUDEL_FLOW_MIN_FILTER_CUTOFF,
  STRUDEL_FLOW_MIN_FILTER_RESONANCE,
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS,
  STRUDEL_FLOW_PAD_NOTE_COUNT,
  STRUDEL_FLOW_PAD_STEP_COUNT,
  STRUDEL_FLOW_SCALE_OPTIONS,
  STRUDEL_FLOW_STEP_COUNT,
  STRUDEL_FLOW_VISUAL_OPTIONS
} from './config'
import {
  createDefaultDrumRows,
  createDefaultPadGrid,
  createStrudelFlowDrumRow,
  STRUDEL_FLOW_CHORDS_DEFAULTS,
  STRUDEL_FLOW_CODE_DEFAULTS,
  STRUDEL_FLOW_DELAY_DEFAULTS,
  STRUDEL_FLOW_ENVELOPE_DEFAULTS,
  STRUDEL_FLOW_FILTER_DEFAULTS,
  STRUDEL_FLOW_LEVEL_DEFAULTS,
  STRUDEL_FLOW_NOTES_DEFAULTS,
  STRUDEL_FLOW_PAD_DEFAULTS,
  STRUDEL_FLOW_SAMPLES_DEFAULTS,
  STRUDEL_FLOW_SPACE_DEFAULTS,
  STRUDEL_FLOW_VISUALIZER_DEFAULTS,
  STRUDEL_FLOW_VOICE_DEFAULTS
} from './nodeDefaults'
import {
  isStoredRecord,
  readStoredChoice,
  readStoredNumber,
  readStoredString
} from './readStoredValue'
import type {
  StrudelFlowCall,
  StrudelFlowCallList,
  StrudelFlowChordsData,
  StrudelFlowDrumRow,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowPadData
} from './types'

const NODE_KINDS: StrudelFlowNodeKind[] = [
  'pad',
  'beats',
  'chords',
  'notes',
  'samples',
  'code',
  'voice',
  'filter',
  'delay',
  'space',
  'level',
  'envelope',
  'visualizer',
  'effect'
]

const readSteps = (value: unknown, fallback: boolean[]): boolean[] =>
  Array.isArray(value) &&
  value.length === STRUDEL_FLOW_STEP_COUNT &&
  value.every((step) => typeof step === 'boolean')
    ? value
    : fallback

const isModifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS.some((option) => option.value === value)

const readStepModifiers = (value: unknown): Record<number, string> =>
  isStoredRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([key, modifier]) => {
          const stepIndex = Number(key)
          return Number.isInteger(stepIndex) &&
            stepIndex >= 0 &&
            stepIndex < STRUDEL_FLOW_STEP_COUNT &&
            isModifier(modifier)
            ? [[stepIndex, modifier]]
            : []
        })
      )
    : {}

const readDrumRow = (value: unknown): StrudelFlowDrumRow | null => {
  if (!isStoredRecord(value)) {
    return null
  }
  // Patches saved before tracks took any sample named the sound `instrument`.
  const sound = readStoredString(value.sound ?? value.instrument, '').trim()
  return sound.length === 0
    ? null
    : {
        sound,
        steps: readSteps(value.steps, createStrudelFlowDrumRow(sound).steps),
        modifiers: readStepModifiers(value.modifiers)
      }
}

const readDrumRows = (value: unknown): StrudelFlowDrumRow[] => {
  const rows = (Array.isArray(value) ? value : [])
    .map(readDrumRow)
    .filter((row): row is StrudelFlowDrumRow => row !== null)
    .slice(0, STRUDEL_FLOW_MAX_DRUM_ROWS)
  return rows.length > 0 ? rows : createDefaultDrumRows()
}

const readInteger = (value: unknown, fallback: number, minimum: number, maximum: number): number =>
  Math.round(readStoredNumber(value, fallback, minimum, maximum))

const readPadGrid = (value: unknown): boolean[][] => {
  const fallback = createDefaultPadGrid()
  if (!Array.isArray(value)) {
    return fallback
  }
  return Array.from({ length: STRUDEL_FLOW_PAD_STEP_COUNT }, (_, stepIndex) => {
    const rawRow = value[stepIndex]
    return Array.from({ length: STRUDEL_FLOW_PAD_NOTE_COUNT }, (_, noteIndex) =>
      Array.isArray(rawRow) ? rawRow[noteIndex] === true : false
    )
  })
}

const readChordProgression = (value: unknown): number[] => {
  const fallback = STRUDEL_FLOW_CHORDS_DEFAULTS.chordProgression
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > STRUDEL_FLOW_STEP_COUNT ||
    !value.every((degree) => Number.isInteger(degree) && degree >= 0 && degree <= 6)
  ) {
    return fallback
  }
  return value
}

const readChordNotes = (value: unknown): number[][] | undefined => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > STRUDEL_FLOW_STEP_COUNT ||
    !value.every(
      (chord) =>
        Array.isArray(chord) &&
        chord.every((note) => Number.isInteger(note) && note >= 0 && note < 28)
    )
  ) {
    return undefined
  }
  return value.map((chord) => [...chord].sort((left, right) => left - right))
}

/**
 * Whether a stored node names a kind this editor knows how to draw and compile.
 * @param value - the stored kind
 * @returns true when it is a node kind
 */
export const isStrudelFlowNodeKind = (value: unknown): value is StrudelFlowNodeKind =>
  typeof value === 'string' && NODE_KINDS.some((kind) => kind === value)

const readMuted = (raw: Record<string, unknown>): { muted?: boolean } =>
  raw.muted === true ? { muted: true } : {}

const readPad = (raw: Record<string, unknown>): StrudelFlowPadData => ({
  ...readMuted(raw),
  kind: 'pad',
  steps: readInteger(raw.steps, STRUDEL_FLOW_PAD_DEFAULTS.steps, 1, STRUDEL_FLOW_PAD_STEP_COUNT),
  mode: readStoredChoice(
    [{ value: 'arp' }, { value: 'chord' }],
    raw.mode,
    STRUDEL_FLOW_PAD_DEFAULTS.mode
  ) as StrudelFlowPadData['mode'],
  octave: readInteger(raw.octave, STRUDEL_FLOW_PAD_DEFAULTS.octave, 1, 8),
  key: readStoredChoice(STRUDEL_FLOW_KEY_OPTIONS, raw.key, STRUDEL_FLOW_PAD_DEFAULTS.key),
  scaleType: readStoredChoice(
    STRUDEL_FLOW_SCALE_OPTIONS,
    raw.scaleType,
    STRUDEL_FLOW_PAD_DEFAULTS.scaleType
  ),
  grid: readPadGrid(raw.grid),
  columnModifiers: readStepModifiers(raw.columnModifiers)
})

const readChords = (raw: Record<string, unknown>): StrudelFlowChordsData => {
  const chordNotes = readChordNotes(raw.chordNotes)
  return {
    ...readMuted(raw),
    kind: 'chords',
    key: readStoredChoice(STRUDEL_FLOW_KEY_OPTIONS, raw.key, STRUDEL_FLOW_CHORDS_DEFAULTS.key),
    octave: readInteger(raw.octave, STRUDEL_FLOW_CHORDS_DEFAULTS.octave, 1, 8),
    scaleType: readStoredChoice(
      STRUDEL_FLOW_CHORD_SCALE_OPTIONS,
      raw.scaleType,
      STRUDEL_FLOW_CHORDS_DEFAULTS.scaleType
    ) as StrudelFlowChordsData['scaleType'],
    chordProgression: readChordProgression(raw.chordProgression),
    ...(chordNotes === undefined ? {} : { chordNotes })
  }
}

const isStoredCall = (value: unknown): value is StrudelFlowCall =>
  isStoredRecord(value) && typeof value.method === 'string' && typeof value.argument === 'string'

const readCalls = (value: unknown): StrudelFlowCall[] =>
  Array.isArray(value)
    ? value.filter(isStoredCall).map((call) => ({ method: call.method, argument: call.argument }))
    : []

const readCallList = (
  kind: StrudelFlowNodeKind,
  raw: Record<string, unknown>
): StrudelFlowCallList => {
  const calls = readCalls(raw.calls)
  return kind === 'effect' || calls.length === 0 ? {} : { calls }
}

type NodeDataReader = (raw: Record<string, unknown>) => StrudelFlowNodeData

const NODE_DATA_READERS: { [Kind in StrudelFlowNodeKind]: NodeDataReader } = {
  pad: readPad,
  beats: (raw) => ({
    ...readMuted(raw),
    kind: 'beats',
    steps: readInteger(raw.steps, STRUDEL_FLOW_DEFAULT_BEATS_STEPS, 1, STRUDEL_FLOW_STEP_COUNT),
    rows: readDrumRows(raw.rows),
    showModifiers: raw.showModifiers === true
  }),
  chords: readChords,
  notes: (raw) => ({
    ...readMuted(raw),
    kind: 'notes',
    pattern: readStoredString(raw.pattern, STRUDEL_FLOW_NOTES_DEFAULTS.pattern)
  }),
  samples: (raw) => ({
    ...readMuted(raw),
    kind: 'samples',
    pattern: readStoredString(raw.pattern, STRUDEL_FLOW_SAMPLES_DEFAULTS.pattern)
  }),
  code: (raw) => ({
    ...readMuted(raw),
    kind: 'code',
    code: readStoredString(raw.code, STRUDEL_FLOW_CODE_DEFAULTS.code)
  }),
  voice: (raw) => ({
    kind: 'voice',
    sound: readStoredString(raw.sound, STRUDEL_FLOW_VOICE_DEFAULTS.sound)
  }),
  filter: (raw) => ({
    kind: 'filter',
    cutoff: readStoredNumber(
      raw.cutoff,
      STRUDEL_FLOW_FILTER_DEFAULTS.cutoff,
      STRUDEL_FLOW_MIN_FILTER_CUTOFF,
      STRUDEL_FLOW_MAX_FILTER_CUTOFF
    ),
    resonance: readStoredNumber(
      raw.resonance,
      STRUDEL_FLOW_FILTER_DEFAULTS.resonance,
      STRUDEL_FLOW_MIN_FILTER_RESONANCE,
      STRUDEL_FLOW_MAX_FILTER_RESONANCE
    )
  }),
  delay: (raw) => ({
    kind: 'delay',
    mix: readStoredNumber(raw.mix, STRUDEL_FLOW_DELAY_DEFAULTS.mix, 0, 1),
    time: readStoredNumber(raw.time, STRUDEL_FLOW_DELAY_DEFAULTS.time, 0, 1),
    feedback: readStoredNumber(raw.feedback, STRUDEL_FLOW_DELAY_DEFAULTS.feedback, 0, 1)
  }),
  space: (raw) => ({
    kind: 'space',
    room: readStoredNumber(raw.room, STRUDEL_FLOW_SPACE_DEFAULTS.room, 0, 1),
    roomSize: readStoredNumber(
      raw.roomSize,
      STRUDEL_FLOW_SPACE_DEFAULTS.roomSize,
      0,
      STRUDEL_FLOW_MAX_ROOM_SIZE
    ),
    roomFade: readStoredNumber(raw.roomFade, STRUDEL_FLOW_SPACE_DEFAULTS.roomFade, 0, 10),
    roomLowPass: readStoredNumber(
      raw.roomLowPass,
      STRUDEL_FLOW_SPACE_DEFAULTS.roomLowPass,
      0,
      20000
    ),
    roomDim: readStoredNumber(raw.roomDim, STRUDEL_FLOW_SPACE_DEFAULTS.roomDim, 0, 20000)
  }),
  level: (raw) => ({
    kind: 'level',
    gain: readStoredNumber(raw.gain, STRUDEL_FLOW_LEVEL_DEFAULTS.gain, 0, 2),
    pan: readStoredNumber(raw.pan, STRUDEL_FLOW_LEVEL_DEFAULTS.pan, 0, 1),
    postgain: readStoredNumber(raw.postgain, STRUDEL_FLOW_LEVEL_DEFAULTS.postgain, 0, 2)
  }),
  envelope: (raw) => ({
    kind: 'envelope',
    attack: readStoredNumber(raw.attack, STRUDEL_FLOW_ENVELOPE_DEFAULTS.attack, 0, 2),
    decay: readStoredNumber(raw.decay, STRUDEL_FLOW_ENVELOPE_DEFAULTS.decay, 0, 2),
    sustain: readStoredNumber(raw.sustain, STRUDEL_FLOW_ENVELOPE_DEFAULTS.sustain, 0, 1),
    release: readStoredNumber(raw.release, STRUDEL_FLOW_ENVELOPE_DEFAULTS.release, 0, 2)
  }),
  visualizer: (raw) => ({
    kind: 'visualizer',
    visual:
      STRUDEL_FLOW_VISUAL_OPTIONS.find((option) => option.value === raw.visual)?.value ??
      STRUDEL_FLOW_VISUALIZER_DEFAULTS.visual,
    placement: raw.placement === 'background' ? 'background' : 'inline',
    options: readStoredString(raw.options, '')
  }),
  // An Effect node stored before calls had a list held its one call as `method` and `argument`.
  effect: (raw) => ({
    kind: 'effect',
    calls:
      raw.calls === undefined && typeof raw.method === 'string'
        ? [{ method: raw.method, argument: readStoredString(raw.argument, '') }]
        : readCalls(raw.calls)
  })
}

/**
 * Reads one node's settings from storage, replacing anything missing or malformed with the
 * kind's defaults. A stored patch made by an older version keeps working as fields are added.
 * @param kind - the node kind named by the stored node
 * @param rawData - the stored settings, unvalidated
 * @returns settings this editor can render and compile
 */
export const readStrudelFlowNodeData = (
  kind: StrudelFlowNodeKind,
  rawData: unknown
): StrudelFlowNodeData => {
  const raw = isStoredRecord(rawData) ? rawData : {}
  return { ...NODE_DATA_READERS[kind](raw), ...readCallList(kind, raw) }
}
