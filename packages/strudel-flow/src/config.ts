export const STRUDEL_FLOW_PATCH_STORAGE_KEY = 'strudel-flow-patch'

export const STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE = 120
export const STRUDEL_FLOW_MIN_BEATS_PER_MINUTE = 1
export const STRUDEL_FLOW_MAX_BEATS_PER_MINUTE = 300
export const STRUDEL_FLOW_STEP_COUNT = 16
export const STRUDEL_FLOW_PAD_STEP_COUNT = 16
export const STRUDEL_FLOW_PAD_NOTE_COUNT = 8

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
export const STRUDEL_FLOW_MIN_SCOPE_SCALE = 0.1
export const STRUDEL_FLOW_MAX_SCOPE_SCALE = 4

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

export const STRUDEL_FLOW_KEY_OPTIONS = [
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C#' },
  { value: 'D', label: 'D' },
  { value: 'D#', label: 'D#' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'F#', label: 'F#' },
  { value: 'G', label: 'G' },
  { value: 'G#', label: 'G#' },
  { value: 'A', label: 'A' },
  { value: 'A#', label: 'A#' },
  { value: 'B', label: 'B' }
]

export const STRUDEL_FLOW_SCALE_OPTIONS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'phrygian', label: 'Phrygian' },
  { value: 'lydian', label: 'Lydian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'aeolian', label: 'Aeolian' },
  { value: 'locrian', label: 'Locrian' },
  { value: 'major:pentatonic', label: 'Major pentatonic' },
  { value: 'minor:pentatonic', label: 'Minor pentatonic' },
  { value: 'blues', label: 'Blues' },
  { value: 'chromatic', label: 'Chromatic' },
  { value: 'diminished', label: 'Diminished' },
  { value: 'harmonic:minor', label: 'Harmonic minor' },
  { value: 'melodic:minor', label: 'Melodic minor' }
]

export const STRUDEL_FLOW_CHORD_SCALE_OPTIONS = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' }
]

export const STRUDEL_FLOW_PAD_MODIFIER_OPTIONS = [
  { value: '', label: 'None' },
  { value: '!2', label: '!2' },
  { value: '!3', label: '!3' },
  { value: '!4', label: '!4' },
  { value: '/2', label: '/2' },
  { value: '/3', label: '/3' },
  { value: '/4', label: '/4' },
  { value: '@2', label: '@2' },
  { value: '@3', label: '@3' },
  { value: '@4', label: '@4' },
  { value: '*2', label: '*2' },
  { value: '*3', label: '*3' },
  { value: '*4', label: '*4' }
]

export const STRUDEL_FLOW_DRUM_ROWS = [
  {
    instrument: 'bd',
    steps: [
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false
    ]
  },
  {
    instrument: 'sd',
    steps: [
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false
    ]
  },
  {
    instrument: 'hh',
    steps: [
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false
    ]
  }
]
