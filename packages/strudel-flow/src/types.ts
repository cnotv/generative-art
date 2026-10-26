export type StrudelFlowDrumInstrument = 'bd' | 'sd' | 'hh'

export type StrudelFlowNodeKind =
  | 'pad'
  | 'beats'
  | 'chords'
  | 'code'
  | 'filter'
  | 'delay'
  | 'space'
  | 'level'
  | 'envelope'
  | 'scope'

export type StrudelFlowNodeCategory = 'Instruments' | 'Effects'

export type StrudelFlowDrumRow = {
  instrument: StrudelFlowDrumInstrument
  steps: boolean[]
}

export type StrudelFlowPadData = {
  kind: 'pad'
  steps: number
  mode: 'arp' | 'chord'
  octave: number
  key: string
  scaleType: string
  grid: boolean[][]
  columnModifiers: Record<number, string>
  sound: string
}

export type StrudelFlowBeatsData = {
  kind: 'beats'
  rows: StrudelFlowDrumRow[]
}

export type StrudelFlowChordsData = {
  kind: 'chords'
  key: string
  octave: number
  scaleType: 'major' | 'minor'
  chordProgression: number[]
  chordNotes?: number[][]
  sound: string
}

export type StrudelFlowCodeData = {
  kind: 'code'
  code: string
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
  | StrudelFlowCodeData
  | StrudelFlowFilterData
  | StrudelFlowDelayData
  | StrudelFlowSpaceData
  | StrudelFlowLevelData
  | StrudelFlowEnvelopeData
  | StrudelFlowScopeData

export type StrudelFlowNodePosition = {
  x: number
  y: number
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
