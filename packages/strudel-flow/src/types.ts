import type { ComputedRef, Ref } from 'vue'

export type StrudelFlowNodeKind =
  | 'pad'
  | 'beats'
  | 'chords'
  | 'notes'
  | 'samples'
  | 'code'
  | 'voice'
  | 'filter'
  | 'delay'
  | 'space'
  | 'level'
  | 'envelope'
  | 'visualizer'
  | 'effect'

export type StrudelFlowNodeCategory = 'Instruments' | 'Effects' | 'Sounds'

/** Set on an instrument whose pattern is silenced with `.hush()` or a `_$:` block. */
export type StrudelFlowMuteFlag = {
  muted?: boolean
}

/** One Beats track: a sample name, its sixteen step switches, and per-step variations. */
export type StrudelFlowDrumRow = {
  sound: string
  steps: boolean[]
  modifiers: Record<number, string>
}

export type StrudelFlowSoundGroup = {
  label: string
  sounds: string[]
}

/** A sample a picker offers: the name code plays it by, and a readable name to show. */
export type StrudelFlowSampleOption = {
  value: string
  label: string
}

/** The host's samples under one heading, such as a drum machine, for the sample pickers. */
export type StrudelFlowSampleGroup = {
  label: string
  samples: StrudelFlowSampleOption[]
}

export type StrudelFlowPadData = StrudelFlowMuteFlag & {
  kind: 'pad'
  steps: number
  mode: 'arp' | 'chord'
  octave: number
  key: string
  scaleType: string
  grid: boolean[][]
  columnModifiers: Record<number, string>
}

export type StrudelFlowBeatsData = StrudelFlowMuteFlag & {
  kind: 'beats'
  /** How many of the sixteen steps play. */
  steps: number
  rows: StrudelFlowDrumRow[]
  /** Whether the variation picker under each step is shown. */
  showModifiers: boolean
}

export type StrudelFlowChordsData = StrudelFlowMuteFlag & {
  kind: 'chords'
  key: string
  octave: number
  scaleType: 'major' | 'minor'
  chordProgression: number[]
  chordNotes?: number[][]
}

/** How a Notes node draws its notes: picked from the sound it plays, or one chosen by hand. */
export type StrudelFlowNotation = 'auto' | 'guitar' | 'bass' | 'piano' | 'names'

/** The view a notation resolves to once Auto has looked at the sound. */
export type StrudelFlowNotationView = Exclude<StrudelFlowNotation, 'auto'>

/** A `note("...")` line in mini notation. */
export type StrudelFlowNotesData = StrudelFlowMuteFlag & {
  kind: 'notes'
  pattern: string
  notation: StrudelFlowNotation
}

/** Notes struck together, when they start in the bar and how long they last, in beats. */
export type StrudelFlowNoteEvent = {
  notes: string[]
  start: number
  beats: number
}

/** One cycle of a pattern, its events in time order. */
export type StrudelFlowNoteBar = StrudelFlowNoteEvent[]

/**
 * Reads a mini notation pattern into bars of notes. The host supplies it, since only the host
 * loads Strudel; a pattern that cannot be read gives no bars.
 */
export type StrudelFlowNoteReader = (
  pattern: string,
  beatsPerCycle: number
) => Promise<StrudelFlowNoteBar[]>

/** What a Notes node needs from the editor around it to draw its notation. */
export type StrudelFlowNotationContext = {
  readNoteBars: StrudelFlowNoteReader | null
  beatsPerCycle: number
  /** The sound a node's notes play, or an empty string when nothing sets one. */
  soundOf: (nodeId: string) => string
}

export type StrudelFlowTabInstrument = 'bass' | 'guitar'

/** Where a note is played: the staff line counted from the top (highest string), and the fret. */
export type StrudelFlowFretPosition = {
  lineIndex: number
  fret: number
}

/** A fret number on the staff, centred on its stem. */
export type StrudelFlowTabFret = StrudelFlowFretPosition & {
  x: number
  y: number
}

export type StrudelFlowTabSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** A stem in the rhythm row. */
export type StrudelFlowTabStem = {
  x: number
}

/** A block in the middle of the staff for a rest, faint so a tab reader passes over it. */
export type StrudelFlowTabRest = {
  x: number
  y: number
  width: number
  height: number
}

/** A triplet bracket under the stems it groups, and where its 3 goes. */
export type StrudelFlowTabBracket = {
  path: string
  labelX: number
}

/** Every mark of a tab staff, in drawing units, ready for an SVG. */
export type StrudelFlowTabLayout = {
  width: number
  height: number
  lineGap: number
  /** Each string's line, broken where a fret number sits on it, from the top string down. */
  strings: StrudelFlowTabSegment[][]
  barLines: StrudelFlowTabSegment[]
  frets: StrudelFlowTabFret[]
  stems: StrudelFlowTabStem[]
  rests: StrudelFlowTabRest[]
  /** Beams and flags; a flag is a beam reaching from one stem only. */
  beams: StrudelFlowTabSegment[]
  /** Arcs from a fret number to the stem where the note goes on ringing. */
  ties: string[]
  brackets: StrudelFlowTabBracket[]
  stemTop: number
  stemBottom: number
  bracketLabelY: number
}

/** An `s("...")` line of samples in mini notation. */
export type StrudelFlowSamplesData = StrudelFlowMuteFlag & {
  kind: 'samples'
  pattern: string
}

/** Any expression the other instruments cannot describe, kept verbatim. */
export type StrudelFlowCodeData = StrudelFlowMuteFlag & {
  kind: 'code'
  code: string
}

export type StrudelFlowVoiceData = {
  kind: 'voice'
  sound: string
}

/** One chained call kept as written, such as `.mask("<1 0>")` or `.jux(rev)`. */
export type StrudelFlowCall = {
  method: string
  argument: string
}

/** One argument of a call the editor has controls for, as `config.ts` describes it. */
export type StrudelFlowCallParameter =
  | { kind: 'number'; label: string; min: number; max: number; step: number }
  | { kind: 'text'; label: string }
  | { kind: 'toggles'; label: string }

/** A call argument read into a control: a slider value, free text, or on and off steps. */
export type StrudelFlowCallField =
  | { kind: 'number'; label: string; min: number; max: number; step: number; value: number }
  | { kind: 'text'; label: string; value: string }
  | {
      kind: 'toggles'
      label: string
      steps: boolean[]
      /** Written `"<1 0>"`, one step per cycle, rather than `"1 0"` within one. */
      perCycle: boolean
    }

/** Calls no dedicated node covers, chained after the node they follow in the code. */
export type StrudelFlowCallList = {
  calls?: StrudelFlowCall[]
}

/** Chained calls with no single node to sit on, such as the ones after a whole `stack(...)`. */
export type StrudelFlowEffectData = {
  kind: 'effect'
  calls: StrudelFlowCall[]
}

export type StrudelFlowFilterData = {
  kind: 'filter'
  cutoff: number
  resonance: number
}

export type StrudelFlowDelayData = {
  kind: 'delay'
  mix: number
  time: number
  feedback: number
}

export type StrudelFlowSpaceData = {
  kind: 'space'
  room: number
  roomSize: number
  roomFade: number
  roomLowPass: number
  roomDim: number
}

export type StrudelFlowLevelData = {
  kind: 'level'
  gain: number
  pan: number
  postgain: number
}

export type StrudelFlowEnvelopeData = {
  kind: 'envelope'
  attack: number
  decay: number
  sustain: number
  release: number
}

export type StrudelFlowVisualName =
  | 'pianoroll'
  | 'punchcard'
  | 'scope'
  | 'spiral'
  | 'pitchwheel'
  | 'spectrum'

/** One of Strudel's visuals: `._name()` draws under the line, `.name()` behind the code. */
export type StrudelFlowVisualizerData = {
  kind: 'visualizer'
  visual: StrudelFlowVisualName
  placement: 'inline' | 'background'
  /** The call's argument as written, such as `{ labels: 1 }`, or empty. */
  options: string
}

export type StrudelFlowNodeData = StrudelFlowCallList &
  (
    | StrudelFlowPadData
    | StrudelFlowBeatsData
    | StrudelFlowChordsData
    | StrudelFlowNotesData
    | StrudelFlowSamplesData
    | StrudelFlowCodeData
    | StrudelFlowVoiceData
    | StrudelFlowFilterData
    | StrudelFlowDelayData
    | StrudelFlowSpaceData
    | StrudelFlowLevelData
    | StrudelFlowEnvelopeData
    | StrudelFlowVisualizerData
    | StrudelFlowEffectData
  )

export type StrudelFlowNodePosition = {
  x: number
  y: number
}

export type StrudelFlowNodeSize = {
  width: number
  height: number
}

export type StrudelFlowNode = {
  id: string
  type: string
  position: StrudelFlowNodePosition
  data: StrudelFlowNodeData
  /** Measured by Vue Flow while the canvas is open; never stored in the patch. */
  dimensions?: { width: number; height: number }
}

export type StrudelFlowEdge = {
  id: string
  source: string
  target: string
}

export type StrudelFlowPatch = {
  nodes: StrudelFlowNode[]
  edges: StrudelFlowEdge[]
  beatsPerMinute: number
  beatsPerCycle: number
  /** Statements that are not a pattern, such as `samples(...)` or `const cc = await midin(...)`. */
  setup: string
}

export type StrudelFlowCompilation = {
  code: string
  errorMessage: string | null
}

export type StrudelFlowNodeDefinition = {
  kind: StrudelFlowNodeKind
  title: string
  category: StrudelFlowNodeCategory
  description: string
}

export type StrudelFlowState = {
  nodes: Ref<StrudelFlowNode[]>
  edges: Ref<StrudelFlowEdge[]>
  beatsPerMinute: Ref<number>
  beatsPerCycle: Ref<number>
  compilation: ComputedRef<StrudelFlowCompilation>
  addNode: (kind: StrudelFlowNodeKind) => void
  updateNodeData: (nodeId: string, data: StrudelFlowNodeData) => void
  removeNode: (nodeId: string) => void
  /** Adds a cable when the same connection rules the canvas uses allow it. */
  connectNodes: (sourceNodeId: string, targetNodeId: string) => boolean
  setBeatsPerMinute: (beatsPerMinute: number) => void
  setBeatsPerCycle: (beatsPerCycle: number) => void
  resetPatch: () => void
  /**
   * Rebuilds the graph from code, reusing node positions where it can.
   * @returns false while the code has a syntax error and the graph was left as it was
   */
  loadCode: (code: string) => boolean
}
