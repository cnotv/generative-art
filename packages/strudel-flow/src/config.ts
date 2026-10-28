import type {
  StrudelFlowCallParameter,
  StrudelFlowNotation,
  StrudelFlowNotationView,
  StrudelFlowVisualName
} from './types'

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

/** Background canvas id that Strudel's `getDrawContext()` paints behind-the-code visuals on. */
export const STRUDEL_FLOW_BACKGROUND_CANVAS_ID = 'test-canvas'

/** The calls a node shows controls for, one entry per argument; any other call stays text. */
export const STRUDEL_FLOW_CALL_PARAMETERS: Record<string, StrudelFlowCallParameter[]> = {
  mask: [{ kind: 'toggles', label: 'Plays' }],
  struct: [{ kind: 'toggles', label: 'Hits' }],
  sometimesBy: [
    { kind: 'number', label: 'Chance', min: 0, max: 1, step: 0.01 },
    { kind: 'text', label: 'Then' }
  ],
  someCyclesBy: [
    { kind: 'number', label: 'Chance', min: 0, max: 1, step: 0.01 },
    { kind: 'text', label: 'Then' }
  ],
  degradeBy: [{ kind: 'number', label: 'Drop', min: 0, max: 1, step: 0.01 }],
  swingBy: [
    { kind: 'number', label: 'Swing', min: 0, max: 0.5, step: 0.01 },
    { kind: 'number', label: 'Subdivision', min: 1, max: 16, step: 1 }
  ],
  fast: [{ kind: 'number', label: 'Speed', min: 0.25, max: 8, step: 0.25 }],
  slow: [{ kind: 'number', label: 'Speed', min: 0.25, max: 8, step: 0.25 }],
  ply: [{ kind: 'number', label: 'Repeats', min: 1, max: 8, step: 1 }],
  late: [{ kind: 'number', label: 'Shift', min: 0, max: 1, step: 0.01 }],
  early: [{ kind: 'number', label: 'Shift', min: 0, max: 1, step: 0.01 }],
  velocity: [{ kind: 'number', label: 'Velocity', min: 0, max: 1, step: 0.01 }],
  speed: [{ kind: 'number', label: 'Rate', min: -2, max: 4, step: 0.05 }],
  crush: [{ kind: 'number', label: 'Bits', min: 1, max: 16, step: 1 }],
  shape: [{ kind: 'number', label: 'Drive', min: 0, max: 1, step: 0.01 }],
  hpf: [{ kind: 'number', label: 'Cutoff', min: 20, max: 20000, step: 10 }]
}

/** MIDI note of each open string, from the top staff line (the highest string) down. */
export const STRUDEL_FLOW_OPEN_STRINGS = {
  bass: [43, 38, 33, 28],
  guitar: [64, 59, 55, 50, 45, 40]
}
export const STRUDEL_FLOW_MAX_FRET = 24
/** The most frets one hand covers, so a chord stays playable. */
export const STRUDEL_FLOW_CHORD_FRET_SPAN = 4

export const STRUDEL_FLOW_NOTATION_OPTIONS: { value: StrudelFlowNotation; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'guitar', label: 'Guitar tab' },
  { value: 'bass', label: 'Bass tab' },
  { value: 'sheet', label: 'Piano sheet' },
  { value: 'piano', label: 'Piano roll' },
  { value: 'names', label: 'Note names' }
]

/** Auto's choice: the first entry whose word is in the sound's name wins; anything else is names. */
export const STRUDEL_FLOW_NOTATION_BY_SOUND: { word: string; view: StrudelFlowNotationView }[] = [
  { word: 'bass', view: 'bass' },
  { word: 'guitar', view: 'guitar' },
  { word: 'piano', view: 'sheet' },
  { word: 'keys', view: 'sheet' },
  { word: 'organ', view: 'sheet' },
  { word: 'rhodes', view: 'sheet' },
  { word: 'harpsichord', view: 'sheet' },
  { word: 'clavinet', view: 'sheet' }
]

/** The tab staff's drawing unit: the gap between two staff lines. */
export const STRUDEL_FLOW_TAB_LINE_GAP = 12
/**
 * Every tab length below is a multiple of the line gap, and mirrors what the tab import reads:
 * stems sit between one and two and three quarter gaps under the staff, beams stack up from the
 * stem's foot, and a triplet bracket runs below the stems.
 */
export const STRUDEL_FLOW_TAB_TOP_MARGIN = 1.5
export const STRUDEL_FLOW_TAB_BOTTOM_MARGIN = 0.8
export const STRUDEL_FLOW_TAB_SIDE_MARGIN = 3
export const STRUDEL_FLOW_TAB_STEM_TOP = 1
export const STRUDEL_FLOW_TAB_STEM_BOTTOM = 2.6
export const STRUDEL_FLOW_TAB_BEAM_THICKNESS = 0.2
export const STRUDEL_FLOW_TAB_BEAM_STEP = 0.4
export const STRUDEL_FLOW_TAB_FLAG_LENGTH = 0.8
export const STRUDEL_FLOW_TAB_BRACKET_Y = 3.4
export const STRUDEL_FLOW_TAB_DIGIT_WIDTH = 0.62
/** Centre to centre of the digits in a two digit fret; wider than a digit so they never touch. */
export const STRUDEL_FLOW_TAB_DIGIT_PITCH = 0.68
export const STRUDEL_FLOW_TAB_DIGIT_CLEARANCE = 0.15
/** A tie leaves its number this far below the line, sags to the second depth, and stops short. */
export const STRUDEL_FLOW_TAB_TIE_TOP = 0.2
export const STRUDEL_FLOW_TAB_TIE_SAG = 0.6
export const STRUDEL_FLOW_TAB_TIE_END_GAP = 0.3
/** Room a stem takes: a fixed part, so short notes stay legible, and a part per beat. */
export const STRUDEL_FLOW_TAB_STEM_SPACE = 2
export const STRUDEL_FLOW_TAB_SPACE_PER_BEAT = 1.5
/** Beats a stem lasts by how many beams or flags it carries: none, one, two, three. */
export const STRUDEL_FLOW_TAB_BEAM_BEATS = [1, 0.5, 0.25, 0.125]
export const STRUDEL_FLOW_TAB_TRIPLET_NUMERATOR = 2
export const STRUDEL_FLOW_TAB_TRIPLET_DENOMINATOR = 3

export const STRUDEL_FLOW_PIANO_ROLL_ROW_HEIGHT = 8
export const STRUDEL_FLOW_PIANO_ROLL_BEAT_WIDTH = 32
export const STRUDEL_FLOW_PIANO_ROLL_GUTTER = 26
export const STRUDEL_FLOW_PIANO_ROLL_MIN_ROWS = 12
/** Pitch classes of the black keys, shaded in the piano roll. */
export const STRUDEL_FLOW_BLACK_KEY_CLASSES = [1, 3, 6, 8, 10]
export const STRUDEL_FLOW_TAB_MIN_BAR_WIDTH = 5
export const STRUDEL_FLOW_TAB_REST_WIDTH = 0.8
export const STRUDEL_FLOW_TAB_REST_HEIGHT = 0.35
export const STRUDEL_FLOW_TAB_STROKE_WIDTH = 0.1
export const STRUDEL_FLOW_TAB_STEM_WIDTH = 0.12
export const STRUDEL_FLOW_TAB_DIGIT_SIZE = 1
/** Half the height of a digit in Arial, so a number written there sits centred on its line. */
export const STRUDEL_FLOW_TAB_DIGIT_BASELINE = 0.36
export const STRUDEL_FLOW_TAB_BRACKET_LABEL_GAP = 0.5
export const STRUDEL_FLOW_TAB_BRACKET_OVERHANG = 0.3
export const STRUDEL_FLOW_TAB_BRACKET_HOOK = 0.25
export const STRUDEL_FLOW_TAB_BRACKET_LABEL_SIZE = 0.7
export const STRUDEL_FLOW_TAB_BRACKET_LABEL_BASELINE = 0.25
export const STRUDEL_FLOW_TAB_BOTTOM_SPACE = 4.3

/** Semitones above C of each note letter, as Strudel reads note names. */
export const STRUDEL_FLOW_PITCH_CLASSES: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11
}
/** Strudel's octave for a note name written without one, such as `c`. */
export const STRUDEL_FLOW_DEFAULT_OCTAVE = 3
export const STRUDEL_FLOW_SHARP_SIGNS = ['#', 's']
/** The finest note length written as a fraction: a 24th of a beat covers sixteenth triplets. */
export const STRUDEL_FLOW_MAX_LENGTH_DENOMINATOR = 24

/** Note letters in staff order, from C up. */
export const STRUDEL_FLOW_NOTE_LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
/** How a MIDI number is spelled on a staff, one name per semitone above C. */
export const STRUDEL_FLOW_SHARP_SPELLINGS = [
  { letter: 'c', alteration: 0 },
  { letter: 'c', alteration: 1 },
  { letter: 'd', alteration: 0 },
  { letter: 'd', alteration: 1 },
  { letter: 'e', alteration: 0 },
  { letter: 'f', alteration: 0 },
  { letter: 'f', alteration: 1 },
  { letter: 'g', alteration: 0 },
  { letter: 'g', alteration: 1 },
  { letter: 'a', alteration: 0 },
  { letter: 'a', alteration: 1 },
  { letter: 'b', alteration: 0 }
]
/** Middle C and up go on the treble staff, everything lower on the bass staff. */
export const STRUDEL_FLOW_SHEET_TREBLE_LOWEST_NOTE = 60
/** The step counted from C0 of each clef's bottom line: E4 and G2. */
export const STRUDEL_FLOW_SHEET_BOTTOM_STEPS = { treble: 30, bass: 18 }
/** Each written note value: its length in beats and how it looks. */
export const STRUDEL_FLOW_SHEET_VALUES = [
  { beats: 4, filled: false, stem: false, flags: 0 },
  { beats: 2, filled: false, stem: true, flags: 0 },
  { beats: 1, filled: true, stem: true, flags: 0 },
  { beats: 0.5, filled: true, stem: true, flags: 1 },
  { beats: 0.25, filled: true, stem: true, flags: 2 },
  { beats: 0.125, filled: true, stem: true, flags: 3 }
]
/** A dot adds half the value again. */
export const STRUDEL_FLOW_SHEET_DOT_FACTOR = 1.5
export const STRUDEL_FLOW_SHEET_CLEF_GLYPHS = { treble: '\u{1D11E}', bass: '\u{1D122}' }
export const STRUDEL_FLOW_SHEET_ACCIDENTAL_GLYPHS = { sharp: '♯', flat: '♭', natural: '♮' }
/** The sheet's drawing unit: the gap between two staff lines. Lengths below are in gaps. */
export const STRUDEL_FLOW_SHEET_LINE_GAP = 8
export const STRUDEL_FLOW_SHEET_TOP_MARGIN = 5
export const STRUDEL_FLOW_SHEET_BOTTOM_MARGIN = 4
/** Top line of the treble staff to the top line of the bass staff in a grand staff. */
export const STRUDEL_FLOW_SHEET_STAFF_DISTANCE = 10
export const STRUDEL_FLOW_SHEET_CLEF_SPACE = 4.5
export const STRUDEL_FLOW_SHEET_COLUMN_SPACE = 2.4
export const STRUDEL_FLOW_SHEET_SPACE_PER_BEAT = 2.5
export const STRUDEL_FLOW_SHEET_ACCIDENTAL_SPACE = 1.4
export const STRUDEL_FLOW_SHEET_MIN_BAR_WIDTH = 6
export const STRUDEL_FLOW_SHEET_HEAD_RADIUS_X = 0.65
export const STRUDEL_FLOW_SHEET_HEAD_RADIUS_Y = 0.45
export const STRUDEL_FLOW_SHEET_STEM_LENGTH = 3.5
export const STRUDEL_FLOW_SHEET_FLAG_STEP = 0.8
export const STRUDEL_FLOW_SHEET_LEDGER_HALF_WIDTH = 1
export const STRUDEL_FLOW_SHEET_ACCIDENTAL_OFFSET = 1.4
export const STRUDEL_FLOW_SHEET_DOT_OFFSET = 1.1
export const STRUDEL_FLOW_SHEET_TIE_OFFSET = 0.7
export const STRUDEL_FLOW_SHEET_TIE_SAG = 0.7
export const STRUDEL_FLOW_SHEET_BRACKET_RISE = 3
export const STRUDEL_FLOW_SHEET_STROKE_WIDTH = 0.12
