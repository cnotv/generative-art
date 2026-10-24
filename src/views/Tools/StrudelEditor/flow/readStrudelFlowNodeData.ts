import {
  STRUDEL_FLOW_CHORD_ROOT_OPTIONS,
  STRUDEL_FLOW_CHORD_TYPE_OPTIONS,
  STRUDEL_FLOW_MAX_FILTER_CUTOFF,
  STRUDEL_FLOW_MAX_FILTER_RESONANCE,
  STRUDEL_FLOW_MAX_ROOM_SIZE,
  STRUDEL_FLOW_MIN_FILTER_CUTOFF,
  STRUDEL_FLOW_MIN_FILTER_RESONANCE,
  STRUDEL_FLOW_SOUND_OPTIONS,
  STRUDEL_FLOW_STEP_COUNT
} from './config'
import {
  createDefaultDrumRows,
  STRUDEL_FLOW_CHORDS_DEFAULTS,
  STRUDEL_FLOW_CODE_DEFAULTS,
  STRUDEL_FLOW_DELAY_DEFAULTS,
  STRUDEL_FLOW_FILTER_DEFAULTS,
  STRUDEL_FLOW_PAD_DEFAULTS,
  STRUDEL_FLOW_SPACE_DEFAULTS
} from './nodeDefaults'
import {
  isStoredRecord,
  readStoredChoice,
  readStoredNumber,
  readStoredString
} from './readStoredValue'
import type {
  StrudelFlowDrumInstrument,
  StrudelFlowDrumRow,
  StrudelFlowNodeData,
  StrudelFlowNodeKind
} from './types'

const NODE_KINDS: StrudelFlowNodeKind[] = [
  'pad',
  'beats',
  'chords',
  'code',
  'filter',
  'delay',
  'space'
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

/**
 * Whether a stored node names a kind this editor knows how to draw and compile.
 * @param value - the stored kind
 * @returns true when it is a node kind
 */
export const isStrudelFlowNodeKind = (value: unknown): value is StrudelFlowNodeKind =>
  typeof value === 'string' && NODE_KINDS.some((kind) => kind === value)

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
  switch (kind) {
    case 'pad':
      return {
        kind,
        notes: readStoredString(raw.notes, STRUDEL_FLOW_PAD_DEFAULTS.notes),
        sound: readStoredChoice(
          STRUDEL_FLOW_SOUND_OPTIONS,
          raw.sound,
          STRUDEL_FLOW_PAD_DEFAULTS.sound
        )
      }
    case 'beats':
      return { kind, rows: readDrumRows(raw.rows) }
    case 'chords':
      return {
        kind,
        root: readStoredChoice(
          STRUDEL_FLOW_CHORD_ROOT_OPTIONS,
          raw.root,
          STRUDEL_FLOW_CHORDS_DEFAULTS.root
        ),
        chordType: readStoredChoice(
          STRUDEL_FLOW_CHORD_TYPE_OPTIONS,
          raw.chordType,
          STRUDEL_FLOW_CHORDS_DEFAULTS.chordType
        ),
        sound: readStoredChoice(
          STRUDEL_FLOW_SOUND_OPTIONS,
          raw.sound,
          STRUDEL_FLOW_CHORDS_DEFAULTS.sound
        )
      }
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
        )
      }
    default:
      throw new Error(`Unsupported node kind: ${kind}`)
  }
}
