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
  | 'scope'
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

/** A `note("...")` line in mini notation. */
export type StrudelFlowNotesData = StrudelFlowMuteFlag & {
  kind: 'notes'
  pattern: string
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

/** Any chained call no dedicated effect covers, such as `.fast(2)` or `.jux(rev)`. */
export type StrudelFlowEffectData = {
  kind: 'effect'
  method: string
  argument: string
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

export type StrudelFlowScopeData = {
  kind: 'scope'
  scale: number
}

export type StrudelFlowNodeData =
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
  | StrudelFlowScopeData
  | StrudelFlowEffectData

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
