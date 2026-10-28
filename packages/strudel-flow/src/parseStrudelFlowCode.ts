import {
  isStrudelCodeSyntaxValid,
  isWrappedInParentheses,
  splitStatements,
  splitTopLevel,
  stripLineComments
} from './codeScanner'
import {
  STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE,
  STRUDEL_FLOW_MAX_DRUM_ROWS,
  STRUDEL_FLOW_STEP_COUNT,
  STRUDEL_FLOW_VISUAL_OPTIONS,
  STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
  STRUDEL_FLOW_KEY_OPTIONS,
  STRUDEL_FLOW_NODE_START_X,
  STRUDEL_FLOW_NODE_START_Y,
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS,
  STRUDEL_FLOW_SCALE_OPTIONS
} from './config'
import { getStrudelFlowNodeSize } from './layout'
import {
  createStrudelFlowDrumRow,
  createStrudelFlowNodeData,
  isStrudelFlowInstrumentKind
} from './nodeDefaults'
import { normalizeStrudelFlowBeatsPerCycle, normalizeStrudelFlowBeatsPerMinute } from './tempo'
import type {
  StrudelFlowBeatsData,
  StrudelFlowChordsData,
  StrudelFlowDrumRow,
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowNodePosition,
  StrudelFlowPadData,
  StrudelFlowPatch,
  StrudelFlowVisualName
} from './types'

type Call = { name: string; argument: string }

type Scale = Pick<StrudelFlowPadData, 'key' | 'octave' | 'scaleType'>

/** Instruments with the effects only they pass through, as one element of a `stack(...)`. */
type Branch = { instruments: StrudelFlowNodeData[]; effects: StrudelFlowNodeData[] }

/** Branches, then the effects every branch shares. */
type ParsedChain = { branches: Branch[]; effects: StrudelFlowNodeData[] }

type Tempo = { beatsPerMinute: number; beatsPerCycle: number }

type EffectKind = 'filter' | 'delay' | 'space' | 'level' | 'envelope'

type EffectCall = { kind: EffectKind; field: string }

type EffectChainState = ParsedChain & { fieldsOnLast: string[] }

type BuildState = {
  nodes: StrudelFlowNode[]
  edges: StrudelFlowEdge[]
  reusable: StrudelFlowNode[]
  rowTop: number
}

const ROW_GAP = 48
const CALL_ROW_HEIGHT = 40
// The Calls label above the rows and the Add call button under them.
const CALL_LIST_HEIGHT = 64
const COLUMN_SPACING = 96
const DEFAULT_SCALE: Scale = { key: 'C', octave: 3, scaleType: 'major' }
const REST_TOKEN = '~'
// Every visual has an inline `_name` and a background `name` call.
const VISUAL_CALLS = new Map<string, StrudelFlowVisualName>(
  STRUDEL_FLOW_VISUAL_OPTIONS.map((option) => option.value).flatMap((visual) => [
    [`_${visual}`, visual],
    [visual, visual]
  ])
)
const DRUM_TOKEN_PATTERN = /^(\d*[A-Za-z]\w*(?::\d+)?)(![2-4]|\/[2-4]|@[2-4]|\*[2-4])?$/
const KEY_ALIASES: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' }
const VOICE_CALLS = new Set(['sound', 's'])
const SAMPLE_HEADS = new Set(['s', 'sound'])
const LABEL_PATTERN = /^(_?\$|[A-Z_a-z]\w*)\s*:(?!:)\s*/
const SETUP_PATTERN = /^(const|let|var|function|async|await|import|class)\b/
const TEMPO_PATTERN = /^setc(pm|ps)\s*\(([^)]*)\)$/

const EFFECT_CALLS: Record<string, EffectCall> = {
  lpf: { kind: 'filter', field: 'cutoff' },
  lpq: { kind: 'filter', field: 'resonance' },
  delay: { kind: 'delay', field: 'mix' },
  delaytime: { kind: 'delay', field: 'time' },
  delayfeedback: { kind: 'delay', field: 'feedback' },
  room: { kind: 'space', field: 'room' },
  roomsize: { kind: 'space', field: 'roomSize' },
  roomfade: { kind: 'space', field: 'roomFade' },
  roomlp: { kind: 'space', field: 'roomLowPass' },
  roomdim: { kind: 'space', field: 'roomDim' },
  gain: { kind: 'level', field: 'gain' },
  pan: { kind: 'level', field: 'pan' },
  postgain: { kind: 'level', field: 'postgain' },
  attack: { kind: 'envelope', field: 'attack' },
  decay: { kind: 'envelope', field: 'decay' },
  sustain: { kind: 'envelope', field: 'sustain' },
  release: { kind: 'envelope', field: 'release' }
}

const isStringLiteral = (value: string): boolean => /^(["'`])[\S\s]*\1$/.test(value.trim())

const readStringLiteral = (literal: string): string => {
  const trimmed = literal.trim()
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      return typeof parsed === 'string' ? parsed : trimmed.slice(1, -1)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed.slice(1, -1).replace(/\\'/g, "'")
}

const readCall = (segment: string): Call | null => {
  const match = /^\s*([$A-Z_a-z][\w$]*)\s*\(([\S\s]*)\)\s*$/.exec(segment)
  return match === null ? null : { name: match[1], argument: match[2].trim() }
}

const readNumber = (argument: string): number | null => {
  const value = Number(argument.trim())
  return argument.trim().length > 0 && Number.isFinite(value) ? value : null
}

const unwrapParentheses = (expression: string): string | null =>
  isWrappedInParentheses(expression) ? expression.slice(1, -1).trim() : null

const readScale = (scale: string): Scale => {
  const match = /^([A-G][#b]?)(-?\d+):(.+)$/.exec(scale)
  if (match === null) {
    return DEFAULT_SCALE
  }
  const key = KEY_ALIASES[match[1]] ?? match[1]
  return {
    key: STRUDEL_FLOW_KEY_OPTIONS.some((option) => option.value === key) ? key : 'C',
    octave: Math.min(8, Math.max(1, Number(match[2]))),
    scaleType: STRUDEL_FLOW_SCALE_OPTIONS.some((option) => option.value === match[3])
      ? match[3]
      : 'major'
  }
}

const readPadStep = (step: string): { notes: number[]; modifier: string } | null => {
  const match = /^\[([^\]]*)](![2-4]|\/[2-4]|@[2-4]|\*[2-4])?$/.exec(step)
  if (match === null) {
    return null
  }
  const notes = match[1]
    .split(/[\s,]+/)
    .filter((note) => note.length > 0 && note !== '~')
    .map(Number)
  if (notes.some((note) => !Number.isInteger(note) || note < 0 || note > 7)) {
    return null
  }
  const modifier = STRUDEL_FLOW_PAD_MODIFIER_OPTIONS.some((option) => option.value === match[2])
    ? (match[2] ?? '')
    : ''
  return { notes, modifier }
}

const readPad = (pattern: string, scale: Scale): StrudelFlowPadData | null => {
  const stepTexts = splitTopLevel(pattern, ' ')
  const steps = stepTexts.map(readPadStep)
  if (steps.length === 0 || steps.length > 16 || steps.some((step) => step === null)) {
    return null
  }
  const parsedSteps = steps.filter((step): step is NonNullable<typeof step> => step !== null)
  return {
    kind: 'pad',
    steps: parsedSteps.length,
    mode: pattern.includes(',') ? 'chord' : 'arp',
    ...scale,
    grid: Array.from({ length: 16 }, (_, stepIndex) =>
      Array.from(
        { length: 8 },
        (_, noteIndex) => parsedSteps[stepIndex]?.notes.includes(noteIndex) ?? false
      )
    ),
    columnModifiers: Object.fromEntries(
      parsedSteps.flatMap((step, stepIndex) =>
        step.modifier.length > 0 ? [[stepIndex, step.modifier]] : []
      )
    )
  }
}

const readChordStep = (chord: string): number[] | null => {
  if (chord === '~') {
    return []
  }
  const match = /^\[([^\]]*)]$/.exec(chord)
  if (match === null) {
    return null
  }
  const notes = splitTopLevel(match[1], ',').map(Number)
  return notes.every((note) => Number.isInteger(note) && note >= 0 && note < 28) ? notes : null
}

const readChords = (pattern: string, scale: Scale): StrudelFlowChordsData | null => {
  if (!pattern.startsWith('<') || !pattern.endsWith('>')) {
    return null
  }
  const chords = splitTopLevel(pattern.slice(1, -1), ' ').map(readChordStep)
  if (chords.length === 0 || chords.length > 16 || chords.some((chord) => chord === null)) {
    return null
  }
  const parsedChords = chords.filter((chord): chord is number[] => chord !== null)
  const progression = parsedChords.map((chord) => (chord[0] ?? 0) % 7)
  const isHandEdited = parsedChords.some(
    (chord, index) =>
      chord.join(',') !== [0, 2, 4].map((step) => step + progression[index]).join(',')
  )
  return {
    kind: 'chords',
    key: scale.key,
    octave: scale.octave,
    scaleType: scale.scaleType === 'minor' ? 'minor' : 'major',
    chordProgression: progression,
    ...(isHandEdited ? { chordNotes: parsedChords } : {})
  }
}

type DrumHit = { sound: string; modifier: string }

const toBeats = (rows: StrudelFlowDrumRow[], steps: number): StrudelFlowBeatsData => ({
  kind: 'beats',
  steps,
  rows,
  showModifiers: rows.some((row) => Object.keys(row.modifiers).length > 0)
})

// One step of a flat sample line: a rest, a sample with an optional variation, or several
// samples hit together as `[bd,hh]`.
const readDrumStep = (token: string): DrumHit[] | null => {
  if (token === REST_TOKEN) {
    return []
  }
  const together = /^\[([^\]]+)]$/.exec(token)
  const hits = (together === null ? [token] : together[1].split(',')).map((part) =>
    DRUM_TOKEN_PATTERN.exec(part.trim())
  )
  return hits.every((hit) => hit !== null)
    ? hits.map((hit) => ({ sound: hit?.[1] ?? '', modifier: hit?.[2] ?? '' }))
    : null
}

/**
 * A flat sample line, `s("bd ~ cp*2 ~")`, as one Beats track per sample. Anything richer, such
 * as sub-sequences, alternation or euclidean rhythms, is left to a Samples node.
 * @param head - the `s(...)` or `sound(...)` call
 * @returns the beats, or null when the line is not a plain step sequence
 */
const readDrumLine = (head: Call): StrudelFlowBeatsData | null => {
  if (!SAMPLE_HEADS.has(head.name) || !isStringLiteral(head.argument)) {
    return null
  }
  const tokens = readStringLiteral(head.argument).trim().split(/\s+/)
  const steps = tokens.map(readDrumStep)
  if (tokens.length > STRUDEL_FLOW_STEP_COUNT || steps.some((step) => step === null)) {
    return null
  }
  const hitsByStep = steps.map((step) => step ?? [])
  const sounds = [...new Set(hitsByStep.flat().map((hit) => hit.sound))]
  if (sounds.length === 0 || sounds.length > STRUDEL_FLOW_MAX_DRUM_ROWS) {
    return null
  }
  return toBeats(
    sounds.map((sound) => ({
      ...createStrudelFlowDrumRow(sound),
      steps: Array.from({ length: STRUDEL_FLOW_STEP_COUNT }, (_, stepIndex) =>
        (hitsByStep[stepIndex] ?? []).some((hit) => hit.sound === sound)
      ),
      modifiers: Object.fromEntries(
        hitsByStep.flatMap((hits, stepIndex) =>
          hits
            .filter((hit) => hit.sound === sound && hit.modifier.length > 0)
            .map((hit) => [stepIndex, hit.modifier])
        )
      )
    })),
    tokens.length
  )
}

// The older shape the editor wrote, `s("bd").struct("1 ~ ...")`, still reads as a track.
const readStructDrumRow = (
  head: Call,
  structCall: Call | undefined
): StrudelFlowBeatsData | null => {
  if (!SAMPLE_HEADS.has(head.name) || structCall === undefined || !isStringLiteral(head.argument)) {
    return null
  }
  const sound = readStringLiteral(head.argument)
  const steps = readStringLiteral(structCall.argument).split(/\s+/)
  if (!DRUM_TOKEN_PATTERN.test(sound) || steps.length > STRUDEL_FLOW_STEP_COUNT) {
    return null
  }
  const hits = steps.flatMap((step, stepIndex) => (step === '1' ? [stepIndex] : []))
  return toBeats([createStrudelFlowDrumRow(sound, hits)], steps.length)
}

const singleBeats = (branch: Branch): StrudelFlowBeatsData | null => {
  const [instrument] = branch.instruments
  return branch.instruments.length === 1 &&
    branch.effects.length === 0 &&
    instrument?.kind === 'beats' &&
    instrument.muted !== true &&
    (instrument.calls ?? []).length === 0
    ? instrument
    : null
}

// Neighbouring tracks of the same length in one stack are one Beats node, which is what a
// Beats node with several tracks compiles to.
const mergeBeatsBranches = (branches: Branch[]): Branch[] =>
  branches.reduce<Branch[]>((merged, branch) => {
    const previous = merged.at(-1)
    const previousBeats = previous === undefined ? null : singleBeats(previous)
    const beats = singleBeats(branch)
    if (
      previousBeats === null ||
      beats === null ||
      previousBeats.steps !== beats.steps ||
      previousBeats.rows.length + beats.rows.length > STRUDEL_FLOW_MAX_DRUM_ROWS
    ) {
      return [...merged, branch]
    }
    return [
      ...merged.slice(0, -1),
      instrumentBranch(toBeats([...previousBeats.rows, ...beats.rows], beats.steps))
    ]
  }, [])

const stripParentheses = (expression: string): string => {
  const inner = unwrapParentheses(expression.trim())
  return inner === null ? expression.trim() : stripParentheses(inner)
}

// Stored without its outer parentheses: compiling adds them back, so they never pile up.
const codeInstrument = (code: string): StrudelFlowNodeData => ({
  kind: 'code',
  code: stripParentheses(code)
})

const withMuted = (data: StrudelFlowNodeData, muted: boolean): StrudelFlowNodeData =>
  muted && isStrudelFlowInstrumentKind(data.kind) ? Object.assign({}, data, { muted: true }) : data

const instrumentBranch = (instrument: StrudelFlowNodeData): Branch => ({
  instruments: [instrument],
  effects: []
})

// An element with effects of its own keeps them on its branch; a nested stack with shared
// effects has no flat shape here, so it stays one Code instrument.
const readStackElement = (element: string): Branch[] => {
  const chain = readChain(element)
  if (chain.effects.length === 0) {
    return chain.branches
  }
  const [onlyBranch] = chain.branches
  return chain.branches.length === 1 && onlyBranch !== undefined
    ? [{ ...onlyBranch, effects: [...onlyBranch.effects, ...chain.effects] }]
    : [instrumentBranch(codeInstrument(element))]
}

const muteBranches = (branches: Branch[], muted: boolean): Branch[] =>
  branches.map((branch) => ({
    ...branch,
    instruments: branch.instruments.map((instrument) => withMuted(instrument, muted))
  }))

const readStack = (argument: string): Branch[] =>
  mergeBeatsBranches(splitTopLevel(argument, ',').flatMap(readStackElement))

const readNotesHead = (head: Call, calls: Call[]): StrudelFlowNodeData | null => {
  const scaleCall = calls.find((call) => call.name === 'scale')
  if (head.name !== 'n' || scaleCall === undefined || !isStringLiteral(head.argument)) {
    return null
  }
  const pattern = readStringLiteral(head.argument)
  const scale = readScale(readStringLiteral(scaleCall.argument))
  return pattern.startsWith('<') ? readChords(pattern, scale) : readPad(pattern, scale)
}

const readMiniNotationHead = (head: Call): StrudelFlowNodeData | null => {
  if (!isStringLiteral(head.argument)) {
    return null
  }
  if (head.name === 'note') {
    return { kind: 'notes', pattern: readStringLiteral(head.argument) }
  }
  return SAMPLE_HEADS.has(head.name)
    ? { kind: 'samples', pattern: readStringLiteral(head.argument) }
    : null
}

const withoutFirst = (calls: Call[], name: string): Call[] => {
  const index = calls.findIndex((call) => call.name === name)
  return index === -1 ? calls : [...calls.slice(0, index), ...calls.slice(index + 1)]
}

// Reads the head of a chain into instruments, and says which chained calls it used up.
const readHead = (headText: string, calls: Call[]): { branches: Branch[]; remaining: Call[] } => {
  const head = readCall(headText)
  if (head === null) {
    return { branches: [instrumentBranch(codeInstrument(headText))], remaining: calls }
  }
  const structBeats = readStructDrumRow(
    head,
    calls.find((call) => call.name === 'struct')
  )
  if (structBeats !== null) {
    return { branches: [instrumentBranch(structBeats)], remaining: withoutFirst(calls, 'struct') }
  }
  const scaled = readNotesHead(head, calls)
  if (scaled !== null) {
    return { branches: [instrumentBranch(scaled)], remaining: withoutFirst(calls, 'scale') }
  }
  if (head.name === 'stack') {
    return { branches: readStack(head.argument), remaining: calls }
  }
  const drumLine = readDrumLine(head)
  if (drumLine !== null) {
    return { branches: [instrumentBranch(drumLine)], remaining: calls }
  }
  const miniNotation = readMiniNotationHead(head)
  return {
    branches: [instrumentBranch(miniNotation ?? codeInstrument(headText))],
    remaining: calls
  }
}

const setEffectField = (
  effect: StrudelFlowNodeData,
  field: string,
  value: number
): StrudelFlowNodeData => Object.assign({}, effect, { [field]: value })

const withCall = (data: StrudelFlowNodeData, call: Call): StrudelFlowNodeData =>
  Object.assign({}, data, {
    calls: [...(data.calls ?? []), { method: call.name, argument: call.argument }]
  })

const replaceLast = (list: StrudelFlowNodeData[], data: StrudelFlowNodeData) => [
  ...list.slice(0, -1),
  data
]

// A call no dedicated node covers sits on the node it follows: the last effect, or the one
// instrument it starts from. A visual only draws the pattern, and after a stack with nothing
// chained yet there is no single node, so the calls there gather on an Effect node.
const startEffectNode = (state: EffectChainState, call: Call): EffectChainState => ({
  ...state,
  effects: [...state.effects, withCall({ kind: 'effect', calls: [] }, call)]
})

const addCallToOnlyBranch = (state: EffectChainState, call: Call): EffectChainState => {
  const [onlyBranch] = state.branches
  const branchEffect = onlyBranch?.effects.at(-1)
  if (state.branches.length !== 1 || onlyBranch === undefined) {
    return startEffectNode(state, call)
  }
  if (branchEffect !== undefined) {
    return branchEffect.kind === 'visualizer'
      ? startEffectNode(state, call)
      : {
          ...state,
          branches: [
            {
              ...onlyBranch,
              effects: replaceLast(onlyBranch.effects, withCall(branchEffect, call))
            }
          ]
        }
  }
  const [onlyInstrument] = onlyBranch.instruments
  return onlyBranch.instruments.length === 1 && onlyInstrument !== undefined
    ? { ...state, branches: [{ ...onlyBranch, instruments: [withCall(onlyInstrument, call)] }] }
    : startEffectNode(state, call)
}

const addGenericCall = (state: EffectChainState, call: Call): EffectChainState => {
  const lastEffect = state.effects.at(-1)
  if (lastEffect === undefined) {
    return addCallToOnlyBranch(state, call)
  }
  return lastEffect.kind === 'visualizer'
    ? startEffectNode(state, call)
    : { ...state, effects: replaceLast(state.effects, withCall(lastEffect, call)) }
}

// Consecutive calls of one effect, such as `.lpf(800).lpq(4)`, share a node until a field
// repeats; a call with a pattern or a slider for its argument stays a call on the node before.
const addEffectCall = (state: EffectChainState, call: Call): EffectChainState => {
  if (VOICE_CALLS.has(call.name) && isStringLiteral(call.argument)) {
    return {
      ...state,
      effects: [...state.effects, { kind: 'voice', sound: readStringLiteral(call.argument) }],
      fieldsOnLast: []
    }
  }
  const visual = VISUAL_CALLS.get(call.name)
  if (visual !== undefined) {
    return {
      ...state,
      effects: [
        ...state.effects,
        {
          kind: 'visualizer',
          visual,
          placement: call.name.startsWith('_') ? 'inline' : 'background',
          options: call.argument
        }
      ],
      fieldsOnLast: []
    }
  }
  const descriptor = EFFECT_CALLS[call.name]
  const value = readNumber(call.argument)
  if (descriptor === undefined || value === null) {
    return addGenericCall(state, call)
  }
  const last = state.effects.at(-1)
  if (last?.kind === descriptor.kind && !state.fieldsOnLast.includes(descriptor.field)) {
    return {
      ...state,
      effects: replaceLast(state.effects, setEffectField(last, descriptor.field, value)),
      fieldsOnLast: [...state.fieldsOnLast, descriptor.field]
    }
  }
  return {
    ...state,
    effects: [
      ...state.effects,
      setEffectField(createStrudelFlowNodeData(descriptor.kind), descriptor.field, value)
    ],
    fieldsOnLast: [descriptor.field]
  }
}

const applyCalls = (chain: ParsedChain, calls: Call[]): ParsedChain => {
  const muted = calls.some((call) => call.name === 'hush')
  const applied = calls
    .filter((call) => call.name !== 'hush')
    .reduce(addEffectCall, { ...chain, fieldsOnLast: [] })
  return { branches: muteBranches(applied.branches, muted), effects: applied.effects }
}

/**
 * Reads one pattern expression into its instrument branches and the effects after them. A
 * call the editor has a node for becomes that node, any other call sits on the node it
 * follows, and a head it cannot read stays a Code instrument.
 * @param expression - one pattern, such as `note("c e").lpf(800).fast(2)`
 * @returns the branches and the shared effects in signal order
 */
const readChain = (expression: string): ParsedChain => {
  const segments = splitTopLevel(expression, '.')
  const calls = segments.slice(1).map(readCall)
  if (segments.length === 0 || calls.some((call) => call === null)) {
    return { branches: [instrumentBranch(codeInstrument(expression))], effects: [] }
  }
  const chainedCalls = calls.filter((call): call is Call => call !== null)
  const inner = unwrapParentheses(segments[0])
  if (inner !== null) {
    return applyCalls(readChain(inner), chainedCalls)
  }
  const head = readHead(
    segments[0],
    chainedCalls.filter((call) => call.name !== 'hush')
  )
  const isMuted = chainedCalls.some((call) => call.name === 'hush')
  return applyCalls(
    { branches: head.branches, effects: [] },
    isMuted ? [...head.remaining, { name: 'hush', argument: '' }] : head.remaining
  )
}

const readTempoValue = (argument: string): number[] =>
  argument.split('/').map((part) => Number(part.trim()))

const readTempo = (statement: string): Tempo | null => {
  const match = TEMPO_PATTERN.exec(statement)
  if (match === null) {
    return null
  }
  const values = readTempoValue(match[2])
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return null
  }
  if (match[1] === 'pm' && values.length === 2) {
    return {
      beatsPerMinute: normalizeStrudelFlowBeatsPerMinute(values[0]),
      beatsPerCycle: normalizeStrudelFlowBeatsPerCycle(values[1])
    }
  }
  const quotient = values.slice(1).reduce((result, divisor) => result / divisor, values[0])
  const cyclesPerMinute = match[1] === 'pm' ? quotient : quotient * 60
  return {
    beatsPerMinute: normalizeStrudelFlowBeatsPerMinute(
      cyclesPerMinute * STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE
    ),
    beatsPerCycle: STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE
  }
}

type Program = {
  blocks: { expression: string; muted: boolean }[]
  setup: string[]
  tempo: Tempo
}

// Strudel plays every labelled block; without one, it plays the program's last expression.
const readProgram = (code: string): Program => {
  const statements = splitStatements(stripLineComments(code))
  const tempo = statements.map(readTempo).find((value): value is Tempo => value !== null) ?? {
    beatsPerMinute: STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
    beatsPerCycle: STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE
  }
  const others = statements.filter((statement) => readTempo(statement) === null)
  const labelled = others.filter((statement) => LABEL_PATTERN.test(statement))
  if (labelled.length > 0) {
    return {
      blocks: labelled.map((statement) => ({
        expression: statement.replace(LABEL_PATTERN, ''),
        muted: statement.startsWith('_')
      })),
      setup: others.filter((statement) => !LABEL_PATTERN.test(statement)),
      tempo
    }
  }
  const last = others.at(-1)
  const lastIsPattern = last !== undefined && !SETUP_PATTERN.test(last)
  return {
    blocks: lastIsPattern ? [{ expression: last, muted: false }] : [],
    setup: lastIsPattern ? others.slice(0, -1) : others,
    tempo
  }
}

const takeReusable = (
  state: BuildState,
  kind: StrudelFlowNodeKind
): { position: StrudelFlowNodePosition | null; reusable: StrudelFlowNode[] } => {
  const index = state.reusable.findIndex((node) => node.data.kind === kind)
  return index === -1
    ? { position: null, reusable: state.reusable }
    : {
        position: state.reusable[index].position,
        reusable: [...state.reusable.slice(0, index), ...state.reusable.slice(index + 1)]
      }
}

const nextNodeId = (kind: StrudelFlowNodeKind, nodes: StrudelFlowNode[]): string => {
  const usedIds = new Set(nodes.map((node) => node.id))
  const index =
    Array.from({ length: nodes.length + 1 }, (_, offset) => offset + 1).find(
      (candidate) => !usedIds.has(`${kind}-${candidate}`)
    ) ?? nodes.length + 1
  return `${kind}-${index}`
}

const placeNode = (
  state: BuildState,
  data: StrudelFlowNodeData,
  fallbackPosition: StrudelFlowNodePosition
): { state: BuildState; nodeId: string } => {
  const reused = takeReusable(state, data.kind)
  const nodeId = nextNodeId(data.kind, state.nodes)
  return {
    nodeId,
    state: {
      ...state,
      reusable: reused.reusable,
      nodes: [
        ...state.nodes,
        { id: nodeId, type: 'strudel', position: reused.position ?? fallbackPosition, data }
      ]
    }
  }
}

const connect = (state: BuildState, source: string, target: string): BuildState => ({
  ...state,
  edges: [...state.edges, { id: `${source}-${target}`, source, target }]
})

const callListHeight = (data: StrudelFlowNodeData): number => {
  const callCount = data.calls?.length ?? 0
  return callCount === 0 ? 0 : CALL_LIST_HEIGHT + callCount * CALL_ROW_HEIGHT
}

const heightOf = (data: StrudelFlowNodeData): number =>
  getStrudelFlowNodeSize(data.kind).height + callListHeight(data) + ROW_GAP

const branchHeight = (branch: Branch): number =>
  Math.max(
    branch.instruments.reduce((height, data) => height + heightOf(data), 0),
    ...branch.effects.map(heightOf)
  )

type ChainPlacement = { state: BuildState; previousIds: string[]; nextX: number }

const widthOf = (data: StrudelFlowNodeData): number => getStrudelFlowNodeSize(data.kind).width

// Places nodes left to right from an x position, each fed by the ones before it, and spaced by
// their own widths so a wide node such as Beats never sits under its neighbour.
const placeInRow = (
  placement: ChainPlacement,
  effects: StrudelFlowNodeData[],
  y: number
): ChainPlacement =>
  effects.reduce((result, data) => {
    const placed = placeNode(result.state, data, { x: result.nextX, y })
    return {
      state: result.previousIds.reduce(
        (connected, sourceId) => connect(connected, sourceId, placed.nodeId),
        placed.state
      ),
      previousIds: [placed.nodeId],
      nextX: result.nextX + widthOf(data) + COLUMN_SPACING
    }
  }, placement)

const placeBranch = (state: BuildState, branch: Branch, y: number): ChainPlacement => {
  const placedInstruments = branch.instruments.reduce(
    (result, data) => {
      const placed = placeNode(result.state, data, { x: STRUDEL_FLOW_NODE_START_X, y: result.y })
      return {
        state: placed.state,
        previousIds: [...result.previousIds, placed.nodeId],
        y: result.y + heightOf(data)
      }
    },
    { state, previousIds: [] as string[], y }
  )
  const instrumentsWidth = Math.max(0, ...branch.instruments.map(widthOf))
  return placeInRow(
    {
      state: placedInstruments.state,
      previousIds: placedInstruments.previousIds,
      nextX: STRUDEL_FLOW_NODE_START_X + instrumentsWidth + COLUMN_SPACING
    },
    branch.effects,
    y
  )
}

// One block lays out as a row: its branches stacked in the first columns, then each shared
// effect one column further right, so the cables read left to right in signal order.
const addChain = (state: BuildState, chain: ParsedChain): BuildState => {
  const placedBranches = chain.branches.reduce(
    (result, branch) => {
      const placed = placeBranch(result.state, branch, result.y)
      return {
        state: placed.state,
        tails: [...result.tails, ...placed.previousIds],
        y: result.y + branchHeight(branch),
        rightEdge: Math.max(result.rightEdge, placed.nextX)
      }
    },
    { state, tails: [] as string[], y: state.rowTop, rightEdge: STRUDEL_FLOW_NODE_START_X }
  )
  const placed = placeInRow(
    {
      state: placedBranches.state,
      previousIds: placedBranches.tails,
      nextX: placedBranches.rightEdge
    },
    chain.effects,
    state.rowTop
  )
  const sharedHeight = Math.max(0, ...chain.effects.map(heightOf))
  return {
    ...placed.state,
    rowTop: Math.max(placedBranches.y, state.rowTop + sharedHeight)
  }
}

/**
 * Rebuilds a flow patch from Strudel code, so whatever the code editor holds also shows as a
 * graph. Recognised calls become their dedicated nodes, any other chained call a generic Effect
 * node, an unreadable pattern head a Code node, and statements that are not patterns stay in
 * the patch's setup, so compiling the result never loses a sound.
 * @param code - the code editor's current program
 * @param existingNodes - nodes whose positions should be reused, matched by kind in order
 * @returns the parsed patch, or null while the code has a syntax error
 */
export const parseStrudelFlowCode = (
  code: string,
  existingNodes: StrudelFlowNode[] = []
): StrudelFlowPatch | null => {
  if (!isStrudelCodeSyntaxValid(code)) {
    return null
  }
  const program = readProgram(code)
  const built = program.blocks
    .map((block) => {
      const chain = readChain(block.expression)
      return { ...chain, branches: muteBranches(chain.branches, block.muted) }
    })
    .reduce(addChain, {
      nodes: [],
      edges: [],
      reusable: existingNodes,
      rowTop: STRUDEL_FLOW_NODE_START_Y
    })
  return {
    nodes: built.nodes,
    edges: built.edges,
    beatsPerMinute: program.tempo.beatsPerMinute,
    beatsPerCycle: program.tempo.beatsPerCycle,
    setup: program.setup.join('\n')
  }
}

// Prefixes the statement Strudel plays with `$:`, matching it on the comment-free copy of the
// code, whose lines keep their original starts.
const labelPlayedExpression = (code: string): string => {
  const commentFree = stripLineComments(code)
  const statements = splitStatements(commentFree).filter(
    (statement) => readTempo(statement) === null
  )
  const last = statements.at(-1)
  if (
    last === undefined ||
    SETUP_PATTERN.test(last) ||
    statements.some((statement) => LABEL_PATTERN.test(statement))
  ) {
    return code
  }
  const start = commentFree.lastIndexOf(last.split('\n')[0])
  const lineIndex = commentFree.slice(0, start).split('\n').length - 1
  const column = start - (commentFree.lastIndexOf('\n', start - 1) + 1)
  const lines = code.split('\n')
  const line = lines[lineIndex]
  return [
    ...lines.slice(0, lineIndex),
    `${line.slice(0, column)}$: ${line.slice(column)}`,
    ...lines.slice(lineIndex + 1)
  ].join('\n')
}

/**
 * Appends labelled blocks to a program so they play alongside what it already plays. Strudel
 * drops an unlabelled last expression once any `$:` block exists, so that expression is
 * labelled first.
 * @param code - the program to extend
 * @param blocks - `$:` blocks to play with it
 * @returns the program followed by the blocks
 */
export const appendStrudelFlowBlocks = (code: string, blocks: string): string => {
  const existing = code.trimEnd()
  return existing.length === 0 ? blocks : `${labelPlayedExpression(existing)}\n\n${blocks}`
}
