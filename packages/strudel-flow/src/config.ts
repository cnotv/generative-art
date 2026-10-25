export const STRUDEL_FLOW_PATCH_STORAGE_KEY = 'strudel-flow-patch'

export const STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE = 120
export const STRUDEL_FLOW_MIN_BEATS_PER_MINUTE = 1
export const STRUDEL_FLOW_MAX_BEATS_PER_MINUTE = 300
export const STRUDEL_FLOW_STEP_COUNT = 16

/** Where a newly added node lands, in graph coordinates, two to a row. */
export const STRUDEL_FLOW_NODE_START_X = 80
export const STRUDEL_FLOW_NODE_START_Y = 120
export const STRUDEL_FLOW_NODE_COLUMN_GAP = 480
export const STRUDEL_FLOW_NODE_ROW_GAP = 360
export const STRUDEL_FLOW_NODE_COLUMNS = 2
export const STRUDEL_FLOW_MAX_NODE_COORDINATE = 100000

export const STRUDEL_FLOW_MIN_FILTER_CUTOFF = 20
export const STRUDEL_FLOW_MAX_FILTER_CUTOFF = 20000
export const STRUDEL_FLOW_MIN_FILTER_RESONANCE = 0.1
export const STRUDEL_FLOW_MAX_FILTER_RESONANCE = 20
export const STRUDEL_FLOW_MAX_ROOM_SIZE = 20

export const STRUDEL_FLOW_EDITOR_MODE_OPTIONS = [
  { value: 'code', label: 'Code' },
  { value: 'flow', label: 'Flow' }
]

export const STRUDEL_FLOW_SOUND_OPTIONS = [
  { value: 'triangle', label: 'Triangle' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'square', label: 'Square' },
  { value: 'sine', label: 'Sine' }
]

export const STRUDEL_FLOW_CHORD_ROOT_OPTIONS = [
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'G', label: 'G' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' }
]

export const STRUDEL_FLOW_CHORD_TYPE_OPTIONS = [
  { value: '', label: 'Major' },
  { value: 'm', label: 'Minor' },
  { value: '^7', label: 'Major 7' },
  { value: '-7', label: 'Minor 7' },
  { value: '7', label: 'Dominant 7' },
  { value: '^9', label: 'Major 9' },
  { value: '-9', label: 'Minor 9' },
  { value: 'sus4', label: 'Suspended 4' }
]

export const STRUDEL_FLOW_DRUM_ROWS = [
  {
    instrument: 'bd',
    steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
  },
  {
    instrument: 'sd',
    steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false]
  },
  {
    instrument: 'hh',
    steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]
  }
]
