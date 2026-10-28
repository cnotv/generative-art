import type { StrudelFlowVisualName } from './types'

export const STRUDEL_FLOW_PATCH_STORAGE_KEY = 'strudel-flow-patch'

/** The editor this package follows: its node set, controls, layout and look. */
export const STRUDEL_FLOW_REFERENCE = {
  name: 'Strudel Flow',
  url: 'https://xyflow.com/strudel-flow',
  author: 'xyflow',
  authorUrl: 'https://xyflow.com',
  sourceUrl: 'https://github.com/xyflow/strudel-flow',
  license: 'AGPL-3.0'
}

export const STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE = 120
export const STRUDEL_FLOW_MIN_BEATS_PER_MINUTE = 1
export const STRUDEL_FLOW_MAX_BEATS_PER_MINUTE = 300
export const STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE = 4
export const STRUDEL_FLOW_BEATS_PER_CYCLE_OPTIONS = [
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' }
]
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

export const STRUDEL_FLOW_VISUAL_OPTIONS: { value: StrudelFlowVisualName; label: string }[] = [
  { value: 'pianoroll', label: 'Pianoroll' },
  { value: 'punchcard', label: 'Punchcard' },
  { value: 'scope', label: 'Scope' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'pitchwheel', label: 'Pitch wheel' },
  { value: 'spectrum', label: 'Spectrum' }
]

export const STRUDEL_FLOW_VISUAL_PLACEMENT_OPTIONS = [
  { value: 'inline', label: 'Under the line' },
  { value: 'background', label: 'Behind the code' }
]

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

export const STRUDEL_FLOW_MAX_DRUM_ROWS = 8
export const STRUDEL_FLOW_DEFAULT_BEATS_STEPS = 16

/** The starter beat: four on the floor, a backbeat snare and eighth-note hats. */
export const STRUDEL_FLOW_DRUM_ROWS = [
  { sound: 'bd', hits: [0, 4, 8, 12] },
  { sound: 'sd', hits: [4, 12] },
  { sound: 'hh', hits: [0, 2, 4, 6, 8, 10, 12, 14] }
]

/** Sounds a new track takes, in order, skipping any the node already uses. */
export const STRUDEL_FLOW_NEW_DRUM_SOUNDS = ['bd', 'sd', 'hh', 'cp', 'ho', 'lt', 'mt', 'cr']

/** Drum and percussion banks from the dirt-samples kit the editor loads, by family. */
export const STRUDEL_FLOW_DRUM_SOUND_GROUPS = [
  {
    label: 'Kicks',
    sounds: ['bd', '808bd', 'clubkick', 'hardkick', 'kicklinn', 'popkick', 'reverbkick']
  },
  {
    label: 'Snares',
    sounds: [
      'sd',
      'sn',
      '808sd',
      'dr',
      'dr2',
      'dr55',
      'dr_few',
      'drum',
      'drumtraks',
      'electro1',
      'gretsch',
      'hardcore',
      'house',
      'ifdrums',
      'jungle'
    ]
  },
  { label: 'Hi-hats', sounds: ['hh', 'hh27', 'linnhats', 'hc', 'ho', 'oc', '808hc', '808oh'] },
  { label: 'Claps', sounds: ['cp', 'realclaps', 'hand', 'clak'] },
  { label: 'Toms', sounds: ['lt', 'mt', 'ht', '808lt', '808mt', '808ht', '808lc', '808mc'] },
  { label: 'Cymbals', sounds: ['cr', '808cy', 'cb', 'rm', 'rs'] },
  {
    label: 'Percussion',
    sounds: ['perc', 'tabla', 'tok', 'tink', 'click', 'stomp', 'glasstap', 'can', 'bottle']
  }
]

/**
 * Strudel names the canvas of an inline visual `<evaluation id>_widget_<call>_<index>`. The
 * editor evaluates without an id, so the name starts at the underscore.
 */
export const STRUDEL_FLOW_WIDGET_ID_PREFIX = '_widget_'
