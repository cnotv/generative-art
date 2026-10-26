/* eslint-disable functional/immutable-data, functional/no-loop-statements --
 * Parsing is a stateful scan: blocks, nodes, edges and effect fields are accumulated. */
import {
  STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
  STRUDEL_FLOW_KEY_OPTIONS,
  STRUDEL_FLOW_NODE_COLUMN_GAP,
  STRUDEL_FLOW_PAD_MODIFIER_OPTIONS,
  STRUDEL_FLOW_SCALE_OPTIONS
} from './config'
import { findStrudelFlowNodePosition } from './layout'
import { createStrudelFlowNodeData } from './nodeDefaults'
import { normalizeStrudelFlowBeatsPerMinute } from './tempo'
import type {
  StrudelFlowChordsData,
  StrudelFlowDrumRow,
  StrudelFlowNode,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowPadData,
  StrudelFlowPatch
} from './types'

type EffectKind = 'filter' | 'delay' | 'space' | 'level' | 'envelope' | 'scope'

type EffectValueField =
  | 'cutoff'
  | 'resonance'
  | 'mix'
  | 'time'
  | 'feedback'
  | 'room'
  | 'roomSize'
  | 'roomFade'
  | 'roomLowPass'
  | 'roomDim'
  | 'gain'
  | 'pan'
  | 'postgain'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'

const EFFECT_CALLS: Record<string, { kind: EffectKind; field?: EffectValueField }> = {
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
  release: { kind: 'envelope', field: 'release' },
  analyze: { kind: 'scope' }
}

type ParsedBlock =
  | { kind: 'instrument'; data: StrudelFlowNodeData; effects: StrudelFlowNodeData[] }
  | { kind: 'code'; code: string }

const readStringLiteral = (literal: string): string => {
  if (literal.startsWith('"')) {
    try {
      return JSON.parse(literal) as string
    } catch {
      return literal.slice(1, -1)
    }
  }
  return literal.slice(1, -1).replace(/\\'/g, "'")
}

const readArgument = (segment: string): { name: string; argument: string } | null => {
  const match = /^\s*([$A-Z_a-z][\w$]*)\s*\(\s*([\S\s]*?)\s*\)\s*$/.exec(segment)
  return match === null ? null : { name: match[1], argument: match[2] }
}

// The scanner tracks quotes, escapes, nesting and the separator in one pass.
// eslint-disable-next-line complexity
const splitTopLevel = (value: string, separator: string): string[] => {
  const parts: string[] = []
  let current = ''
  let quote = ''
  let escaped = false
  let depth = 0
  for (const character of value) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\' && quote.length > 0) {
      current += character
      escaped = true
      continue
    }
    if (quote.length > 0) {
      current += character
      if (character === quote) {
        quote = ''
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      current += character
      continue
    }
    if (character === '(' || character === '[' || character === '{') {
      depth += 1
      current += character
      continue
    }
    if (character === ')' || character === ']' || character === '}') {
      depth -= 1
      current += character
      continue
    }
    if (character === separator && depth === 0) {
      if (current.trim().length > 0) {
        parts.push(current.trim())
      }
      current = ''
      continue
    }
    current += character
  }
  if (current.trim().length > 0) {
    parts.push(current.trim())
  }
  return parts
}

const splitChain = (expression: string): string[] => splitTopLevel(expression, '.')

const readScale = (scale: string): Pick<StrudelFlowPadData, 'key' | 'octave' | 'scaleType'> => {
  const match = /^([A-G][#b]?)(-?\d+):(.+)$/.exec(scale)
  if (match === null) {
    return { key: 'C', octave: 3, scaleType: 'major' }
  }
  const keyAliases: Record<string, string> = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#'
  }
  const key = keyAliases[match[1]] ?? match[1]
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
    .map((note) => Number(note))
  if (notes.some((note) => !Number.isInteger(note) || note < 0 || note > 7)) {
    return null
  }
  const modifier =
    match[2] !== undefined &&
    STRUDEL_FLOW_PAD_MODIFIER_OPTIONS.some((option) => option.value === match[2])
      ? match[2]
      : ''
  return { notes, modifier }
}

const readPad = (
  pattern: string,
  scale: ReturnType<typeof readScale>,
  sound: string
): StrudelFlowPadData | null => {
  const steps = splitTopLevel(pattern, ' ').flatMap((step) => {
    const parsedStep = readPadStep(step)
    return parsedStep === null ? [] : [parsedStep]
  })
  if (steps.length === 0 || steps.length > 16) {
    return null
  }
  const grid = Array.from({ length: 16 }, () => Array<boolean>(8).fill(false))
  const columnModifiers: Record<number, string> = {}
  steps.forEach((step, stepIndex) => {
    step.notes.forEach((note) => {
      grid[stepIndex][note] = true
    })
    if (step.modifier.length > 0) {
      columnModifiers[stepIndex] = step.modifier
    }
  })
  return {
    kind: 'pad',
    steps: steps.length,
    mode: pattern.includes(',') ? 'chord' : 'arp',
    octave: scale.octave,
    key: scale.key,
    scaleType: scale.scaleType,
    grid,
    columnModifiers,
    sound
  }
}

const readChords = (
  pattern: string,
  scale: ReturnType<typeof readScale>,
  sound: string
): StrudelFlowChordsData | null => {
  if (!pattern.startsWith('<') || !pattern.endsWith('>')) {
    return null
  }
  const chordSteps = splitTopLevel(pattern.slice(1, -1), ' ')
  if (chordSteps.length === 0 || chordSteps.length > 16) {
    return null
  }
  const chords = chordSteps.flatMap((chord) => {
    if (chord === '~') {
      return [[]]
    }
    const match = /^\[([^\]]*)]$/.exec(chord)
    if (match === null) {
      return []
    }
    const notes = splitTopLevel(match[1], ',').map((note) => Number(note))
    return notes.every((note) => Number.isInteger(note) && note >= 0 && note < 28) ? [notes] : []
  })
  if (chords.length !== chordSteps.length) {
    return null
  }
  const progression = chords.map((chord) => (chord[0] ?? 0) % 7)
  const expectedChords = progression.map((root) => [root, root + 2, root + 4])
  const manual = chords.some((chord, index) => chord.join(',') !== expectedChords[index]?.join(','))
  return {
    kind: 'chords',
    key: scale.key,
    octave: scale.octave >= 1 ? scale.octave : 4,
    scaleType: scale.scaleType === 'minor' ? 'minor' : 'major',
    chordProgression: progression,
    ...(manual ? { chordNotes: chords } : {}),
    sound
  }
}

const readDrumRowFromCalls = (
  head: { name: string; argument: string },
  calls: string[]
): StrudelFlowDrumRow | null => {
  if (head.name !== 's') {
    return null
  }
  const instrument = readStringLiteral(head.argument)
  if (!['bd', 'sd', 'hh'].includes(instrument)) {
    return null
  }
  const structCall = calls
    .slice(1)
    .map(readArgument)
    .find((call) => call?.name === 'struct')
  if (structCall === undefined || structCall === null) {
    return null
  }
  const steps = readStringLiteral(structCall.argument)
    .split(/\s+/)
    .map((step) => step === '1')
  return steps.length === 16
    ? { instrument: instrument as StrudelFlowDrumRow['instrument'], steps }
    : null
}

const readDrumRow = (expression: string): StrudelFlowDrumRow | null => {
  const calls = splitChain(expression)
  const head = calls[0] === undefined ? null : readArgument(calls[0])
  return head === null ? null : readDrumRowFromCalls(head, calls)
}

const readBeats = (
  head: { name: string; argument: string },
  calls: string[]
): StrudelFlowNodeData | null => {
  if (head.name === 's') {
    const row = readDrumRowFromCalls(head, calls)
    return row === null ? null : { kind: 'beats', rows: [row] }
  }
  if (head.name !== 'stack') {
    return null
  }
  const expressions = splitTopLevel(head.argument, ',')
  const rows = expressions.flatMap((expression) => {
    const row = readDrumRow(expression)
    return row === null ? [] : [row]
  })
  return rows.length > 0 && rows.length === expressions.length ? { kind: 'beats', rows } : null
}

const readNumberArgument = (argument: string): number | null => {
  const value = Number(argument.trim())
  return Number.isFinite(value) ? value : null
}

const applyEffectCall = (
  effects: StrudelFlowNodeData[],
  name: string,
  argument: string
): boolean => {
  const descriptor = EFFECT_CALLS[name]
  if (descriptor === undefined) {
    return false
  }
  const number = readNumberArgument(argument)
  if (descriptor.field !== undefined && number === null) {
    return false
  }
  const previous = effects.at(-1)
  const effect =
    previous?.kind === descriptor.kind ? previous : createStrudelFlowNodeData(descriptor.kind)
  if (effect !== previous) {
    effects.push(effect)
  }
  if (descriptor.field !== undefined) {
    const fields = effect as unknown as Partial<Record<EffectValueField, number>>
    fields[descriptor.field] = number as number
  }
  return true
}

const unwrapCode = (expression: string): string => {
  if (!expression.startsWith('(') || !expression.endsWith(')')) {
    return expression
  }
  const inner = expression.slice(1, -1).trim()
  return inner.length > 0 ? inner : expression
}

const readInstrument = (
  head: { name: string; argument: string },
  calls: string[],
  scale: ReturnType<typeof readScale>,
  sound: string
): StrudelFlowNodeData | null => {
  const beats = readBeats(head, calls)
  if (beats !== null) {
    return beats
  }
  if (head.name !== 'n') {
    return null
  }
  const pattern = readStringLiteral(head.argument)
  if (pattern.startsWith('<')) {
    return readChords(pattern, scale, sound)
  }
  return readPad(pattern, scale, sound)
}

const parseBlock = (block: string): ParsedBlock => {
  const expression = block.trim().replace(/;+\s*$/, '')
  if (expression.length === 0) {
    return { kind: 'code', code: '' }
  }
  const calls = splitChain(expression)
  const head = calls[0] === undefined ? null : readArgument(calls[0])
  if (head === null) {
    return { kind: 'code', code: unwrapCode(expression) }
  }
  const effects: StrudelFlowNodeData[] = []
  let sound = 'triangle'
  let scale: ReturnType<typeof readScale> = { key: 'C', octave: 3, scaleType: 'major' }
  for (const call of calls.slice(1)) {
    const parsedCall = readArgument(call)
    if (parsedCall === null) {
      return { kind: 'code', code: unwrapCode(expression) }
    }
    if (parsedCall.name === 'sound') {
      sound = readStringLiteral(parsedCall.argument)
      continue
    }
    if (parsedCall.name === 'scale') {
      scale = readScale(readStringLiteral(parsedCall.argument))
      continue
    }
    if (!applyEffectCall(effects, parsedCall.name, parsedCall.argument)) {
      return { kind: 'code', code: unwrapCode(expression) }
    }
  }
  const data = readInstrument(head, calls, scale, sound)
  return data === null
    ? { kind: 'code', code: unwrapCode(expression) }
    : { kind: 'instrument', data, effects }
}

const readTempo = (code: string): number => {
  const match = /setcpm\(\s*([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(code)
  if (match === null) {
    return STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE
  }
  const cyclesPerMinute = Number(match[1]) / (match[2] === undefined ? 1 : Number(match[2]))
  return normalizeStrudelFlowBeatsPerMinute(cyclesPerMinute * 4)
}

const splitBlocks = (code: string): string[] => {
  const withoutTempo = code.replace(/setcpm\([^)]*\)/g, '')
  const parts = withoutTempo.split(/^\s*\$\s*:\s*/m)
  const blocks = parts.length > 1 ? parts.slice(1) : parts
  return blocks
    .map((block) => block.trim().replace(/;+\s*$/, ''))
    .filter((block) => block.length > 0)
}

const createNodeId = (
  kind: StrudelFlowNodeKind,
  usedIds: Set<string>,
  counters: Map<string, number>
): string => {
  let index = counters.get(kind) ?? 1
  while (usedIds.has(`${kind}-${index}`)) {
    index += 1
  }
  counters.set(kind, index + 1)
  usedIds.add(`${kind}-${index}`)
  return `${kind}-${index}`
}

/**
 * Rebuilds a flow patch from Strudel code. The parser understands the code this editor
 * writes, plus hand-written variants of the same calls; anything else is kept verbatim in a
 * Code node so its sound is never lost.
 * @param code - the code editor's current pattern
 * @param existingNodes - nodes whose positions should be reused
 * @returns the parsed patch, or null when the code has nothing to show
 */
export const parseStrudelFlowCode = (
  code: string,
  existingNodes: StrudelFlowNode[] = []
): StrudelFlowPatch | null => {
  const blocks = splitBlocks(code)
  if (blocks.length === 0) {
    return null
  }
  const parsedBlocks = blocks
    .map(parseBlock)
    .filter((block) => block.kind === 'instrument' || block.code.length > 0)
  if (parsedBlocks.length === 0) {
    return null
  }
  const existingByKind = new Map<StrudelFlowNodeKind, StrudelFlowNode[]>()
  existingNodes.forEach((node) => {
    const kindNodes = existingByKind.get(node.data.kind) ?? []
    existingByKind.set(node.data.kind, [...kindNodes, node])
  })
  const usedIds = new Set<string>()
  const counters = new Map<string, number>()
  const nodes: StrudelFlowNode[] = []
  const edges: StrudelFlowPatch['edges'] = []

  parsedBlocks.forEach((block) => {
    if (block.kind === 'code') {
      const data = { kind: 'code' as const, code: block.code }
      const reused = existingByKind.get('code')?.shift()
      nodes.push({
        id: createNodeId('code', usedIds, counters),
        type: 'strudel',
        position: reused?.position ?? findStrudelFlowNodePosition(nodes, 'code'),
        data
      })
      return
    }
    const reusedInstrument = existingByKind.get(block.data.kind)?.shift()
    const position =
      reusedInstrument?.position ?? findStrudelFlowNodePosition(nodes, block.data.kind)
    const instrumentId = createNodeId(block.data.kind, usedIds, counters)
    nodes.push({ id: instrumentId, type: 'strudel', position, data: block.data })
    let sourceId = instrumentId
    block.effects.forEach((effect, effectIndex) => {
      const reusedEffect = existingByKind.get(effect.kind)?.shift()
      const effectPosition = reusedEffect?.position ?? {
        x: position.x + STRUDEL_FLOW_NODE_COLUMN_GAP * (effectIndex + 1),
        y: position.y
      }
      const effectId = createNodeId(effect.kind, usedIds, counters)
      nodes.push({ id: effectId, type: 'strudel', position: effectPosition, data: effect })
      edges.push({ id: `${sourceId}-${effectId}`, source: sourceId, target: effectId })
      sourceId = effectId
    })
  })

  return {
    nodes,
    edges,
    beatsPerMinute: readTempo(code)
  }
}
