import {
  STRUDEL_FLOW_CHORD_SCALE_OPTIONS,
  STRUDEL_FLOW_KEY_OPTIONS,
  STRUDEL_FLOW_MAX_FILTER_CUTOFF,
  STRUDEL_FLOW_MAX_FILTER_RESONANCE,
  STRUDEL_FLOW_MAX_ROOM_SIZE,
  STRUDEL_FLOW_MAX_SCOPE_SCALE,
  STRUDEL_FLOW_MIN_FILTER_CUTOFF,
  STRUDEL_FLOW_MIN_FILTER_RESONANCE,
  STRUDEL_FLOW_MIN_SCOPE_SCALE,
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS,
  STRUDEL_FLOW_PAD_NOTE_COUNT,
  STRUDEL_FLOW_PAD_STEP_COUNT,
  STRUDEL_FLOW_SCALE_OPTIONS,
  STRUDEL_FLOW_SOUND_OPTIONS,
  STRUDEL_FLOW_STEP_COUNT
} from './config'
import {
  createDefaultDrumRows,
  createDefaultPadGrid,
  STRUDEL_FLOW_CHORDS_DEFAULTS,
  STRUDEL_FLOW_CODE_DEFAULTS,
  STRUDEL_FLOW_DELAY_DEFAULTS,
  STRUDEL_FLOW_ENVELOPE_DEFAULTS,
  STRUDEL_FLOW_FILTER_DEFAULTS,
  STRUDEL_FLOW_LEVEL_DEFAULTS,
  STRUDEL_FLOW_PAD_DEFAULTS,
  STRUDEL_FLOW_SCOPE_DEFAULTS,
  STRUDEL_FLOW_SPACE_DEFAULTS
} from './nodeDefaults'
import {
  isStoredRecord,
  readStoredChoice,
  readStoredNumber,
  readStoredString
} from './readStoredValue'
import type {
  StrudelFlowChordsData,
  StrudelFlowDrumInstrument,
  StrudelFlowDrumRow,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowPadData
} from './types'

const NODE_KINDS: StrudelFlowNodeKind[] = [
  'pad',
  'beats',
  'chords',
  'code',
  'filter',
  'delay',
  'space',
  'level',
  'envelope',
  'scope'
]

const DRUM_INSTRUMENTS: StrudelFlowDrumInstrument[] = ['bd', 'sd', 'hh']

const readSteps = (value: unknown, fallback: boolean[]): boolean[] =>
  Array.isArray(value) &&
  value.length === STRUDEL_FLOW_STEP_COUNT &&
  value.every((step) => typeof step === 'boolean')
    ? value
    : fallback

const isDrumInstrument = (value: unknown): value is StrudelFlowDrumInstrument =>
  typeof value === 'string' && DRUM_INSTRUMENTS.some((instrument) => instrument === value)

const readDrumRows = (value: unknown): StrudelFlowDrumRow[] => {
  const fallbackRows = createDefaultDrumRows()
  if (!Array.isArray(value)) {
    return fallbackRows
  }
  return fallbackRows.map((fallbackRow) => {
    const rawRow = value.find(
      (row): row is Record<string, unknown> =>
        isStoredRecord(row) &&
        isDrumInstrument(row.instrument) &&
        row.instrument === fallbackRow.instrument
    )
    return {
      instrument: fallbackRow.instrument,
      steps: readSteps(rawRow?.steps, fallbackRow.steps)
    }
  })
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

const readPadColumnModifiers = (value: unknown): Record<number, string> => {
  if (!isStoredRecord(value)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, rawModifier]) => {
      const stepIndex = Number(key)
      const valid =
        Number.isInteger(stepIndex) &&
        stepIndex >= 0 &&
        stepIndex < STRUDEL_FLOW_PAD_STEP_COUNT &&
        typeof rawModifier === 'string' &&
        rawModifier.length > 0 &&
        STRUDEL_FLOW_PAD_MODIFIER_OPTIONS.some((option) => option.value === rawModifier)
      return valid ? ([[stepIndex, rawModifier]] as const) : []
    })
  ) as Record<number, string>
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

const readPad = (raw: Record<string, unknown>): StrudelFlowPadData => ({
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
  columnModifiers: readPadColumnModifiers(raw.columnModifiers),
  sound: readStoredChoice(STRUDEL_FLOW_SOUND_OPTIONS, raw.sound, STRUDEL_FLOW_PAD_DEFAULTS.sound)
})

const readChords = (raw: Record<string, unknown>): StrudelFlowChordsData => {
  const chordNotes = readChordNotes(raw.chordNotes)
  return {
    kind: 'chords',
    key: readStoredChoice(STRUDEL_FLOW_KEY_OPTIONS, raw.key, STRUDEL_FLOW_CHORDS_DEFAULTS.key),
    octave: readInteger(raw.octave, STRUDEL_FLOW_CHORDS_DEFAULTS.octave, 1, 8),
    scaleType: readStoredChoice(
      STRUDEL_FLOW_CHORD_SCALE_OPTIONS,
      raw.scaleType,
      STRUDEL_FLOW_CHORDS_DEFAULTS.scaleType
    ) as StrudelFlowChordsData['scaleType'],
    chordProgression: readChordProgression(raw.chordProgression),
    ...(chordNotes === undefined ? {} : { chordNotes }),
    sound: readStoredChoice(
      STRUDEL_FLOW_SOUND_OPTIONS,
      raw.sound,
      STRUDEL_FLOW_CHORDS_DEFAULTS.sound
    )
  }
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
  // The switch is one branch per node kind; splitting it would only hide that shape.
  // eslint-disable-next-line complexity
): StrudelFlowNodeData => {
  const raw = isStoredRecord(rawData) ? rawData : {}
  switch (kind) {
    case 'pad':
      return readPad(raw)
    case 'beats':
      return { kind, rows: readDrumRows(raw.rows) }
    case 'chords':
      return readChords(raw)
    case 'code':
      return { kind, code: readStoredString(raw.code, STRUDEL_FLOW_CODE_DEFAULTS.code) }
    case 'filter':
      return {
        kind,
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
      }
    case 'delay':
      return {
        kind,
        mix: readStoredNumber(raw.mix, STRUDEL_FLOW_DELAY_DEFAULTS.mix, 0, 1),
        time: readStoredNumber(raw.time, STRUDEL_FLOW_DELAY_DEFAULTS.time, 0, 1),
        feedback: readStoredNumber(raw.feedback, STRUDEL_FLOW_DELAY_DEFAULTS.feedback, 0, 1)
      }
    case 'space':
      return {
        kind,
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
      }
    case 'level':
      return {
        kind,
        gain: readStoredNumber(raw.gain, STRUDEL_FLOW_LEVEL_DEFAULTS.gain, 0, 2),
        pan: readStoredNumber(raw.pan, STRUDEL_FLOW_LEVEL_DEFAULTS.pan, 0, 1),
        postgain: readStoredNumber(raw.postgain, STRUDEL_FLOW_LEVEL_DEFAULTS.postgain, 0, 2)
      }
    case 'envelope':
      return {
        kind,
        attack: readStoredNumber(raw.attack, STRUDEL_FLOW_ENVELOPE_DEFAULTS.attack, 0, 2),
        decay: readStoredNumber(raw.decay, STRUDEL_FLOW_ENVELOPE_DEFAULTS.decay, 0, 2),
        sustain: readStoredNumber(raw.sustain, STRUDEL_FLOW_ENVELOPE_DEFAULTS.sustain, 0, 1),
        release: readStoredNumber(raw.release, STRUDEL_FLOW_ENVELOPE_DEFAULTS.release, 0, 2)
      }
    case 'scope':
      return {
        kind,
        scale: readStoredNumber(
          raw.scale,
          STRUDEL_FLOW_SCOPE_DEFAULTS.scale,
          STRUDEL_FLOW_MIN_SCOPE_SCALE,
          STRUDEL_FLOW_MAX_SCOPE_SCALE
        )
      }
    default:
      throw new Error(`Unsupported node kind: ${kind}`)
  }
}
