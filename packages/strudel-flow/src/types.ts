export type StrudelFlowDrumInstrument = 'bd' | 'sd' | 'hh'

export type StrudelFlowNodeKind = 'pad' | 'beats' | 'chords' | 'code' | 'filter' | 'delay' | 'space'

export type StrudelFlowNodeCategory = 'Instruments' | 'Effects'

export type StrudelFlowDrumRow = {
  instrument: StrudelFlowDrumInstrument
  steps: boolean[]
}

export type StrudelFlowPadData = {
  kind: 'pad'
  notes: string
  sound: string
}

export type StrudelFlowBeatsData = {
  kind: 'beats'
  rows: StrudelFlowDrumRow[]
}

export type StrudelFlowChordsData = {
  kind: 'chords'
  root: string
  chordType: string
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
}

export type StrudelFlowNodeData =
  | StrudelFlowPadData
  | StrudelFlowBeatsData
  | StrudelFlowChordsData
  | StrudelFlowCodeData
  | StrudelFlowFilterData
  | StrudelFlowDelayData
  | StrudelFlowSpaceData

export type StrudelFlowNodePosition = {
  x: number
  y: number
}

export type StrudelFlowNode = {
  id: string
  type: string
  position: StrudelFlowNodePosition
  data: StrudelFlowNodeData
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
