import { stripLineComments } from './codeScanner'
import { getStrudelFlowCodeOrder } from './compileStrudelFlow'
import { isStrudelFlowInstrumentKind } from './nodeDefaults'
import { generateStrudelFlowNodePattern } from './nodePatterns'
import type {
  StrudelFlowCodeRange,
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowNodeCodeRange
} from './types'

/** The call names that start a node's code, and whether they are chained after a dot. */
type NodeKey = { chained: boolean; names: string[] }

const SAMPLE_HEADS = ['s', 'sound']
const EFFECT_INPUT = 'input'
const HEAD_PATTERN = /^\(?\s*([$A-Z_a-z][\w$]*)\s*\(/
const METHOD_PATTERN = new RegExp(`^${EFFECT_INPUT}\\.([$A-Z_a-z][\\w$]*)\\(`)

// Nodes whose code starts with a fixed name, whatever their settings.
const fixedKey = (node: StrudelFlowNode): NodeKey | null => {
  const data = node.data
  if (data.kind === 'beats' || data.kind === 'samples' || data.kind === 'voice') {
    return { chained: data.kind === 'voice', names: SAMPLE_HEADS }
  }
  if (data.kind !== 'effect') {
    return null
  }
  const method = data.calls[0]?.method.trim() ?? ''
  return { chained: true, names: method.length === 0 ? [] : [method] }
}

const readKey = (node: StrudelFlowNode): NodeKey | null => {
  const fixed = fixedKey(node)
  if (fixed !== null) {
    return fixed.names.length === 0 ? null : fixed
  }
  const instrument = isStrudelFlowInstrumentKind(node.data.kind)
  const code = generateStrudelFlowNodePattern(node.data, instrument ? '' : EFFECT_INPUT)
  const name = (instrument ? HEAD_PATTERN : METHOD_PATTERN).exec(code)?.[1]
  return name === undefined ? null : { chained: !instrument, names: [name] }
}

const keyId = (key: NodeKey): string => `${key.chained}:${[...key.names].sort().join(',')}`

// A Beats node read from several `s(...)` lines in one stack writes one line per sounding track.
const occurrenceCount = (node: StrudelFlowNode): number =>
  node.data.kind === 'beats'
    ? Math.max(1, node.data.rows.filter((row) => row.steps.some((step) => step)).length)
    : 1

// Comments become spaces, so a call named in a comment is never found and offsets still hold.
const blankComments = (code: string): string => {
  const strippedLines = stripLineComments(code).split('\n')
  return code
    .split('\n')
    .map((line, index) => (strippedLines[index] ?? '').padEnd(line.length))
    .join('\n')
}

const findCallEnd = (code: string, openIndex: number): number =>
  [...code.slice(openIndex)].reduce(
    (state, character, offset) => {
      if (state.end !== -1) {
        return state
      }
      const depth = state.depth + (character === '(' ? 1 : character === ')' ? -1 : 0)
      return { depth, end: depth === 0 ? openIndex + offset + 1 : -1 }
    },
    { depth: 0, end: -1 }
  ).end

const findCalls = (code: string, key: NodeKey): StrudelFlowCodeRange[] => {
  const names = key.names.map((name) => name.replace(/\$/g, '\\$')).join('|')
  const boundary = key.chained ? '\\.\\s*' : '(?<![\\w$.])'
  const callPattern = new RegExp(`${boundary}(${names})\\s*\\(`, 'g')
  return [...code.matchAll(callPattern)].flatMap((match) => {
    const from = (match.index ?? 0) + match[0].indexOf(match[1])
    const to = findCallEnd(code, (match.index ?? 0) + match[0].length - 1)
    return to === -1 ? [] : [{ from, to }]
  })
}

/**
 * Finds the code every node writes in the program: for each node, the calls of its kind that
 * follow the nodes of the same kind before it in code order, one per sounding Beats row.
 * ponytail: matched by call name and position, not by parsing; a helper in the setup that makes
 * the same call shifts the count. Track source offsets in the parser if that ever matters.
 * @param code - the program in the code editor
 * @param nodes - the patch's nodes
 * @param edges - the patch's cables
 * @returns the ranges of every node's calls, in code order of the nodes
 */
export const getStrudelFlowNodeCodeRanges = (
  code: string,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[]
): StrudelFlowNodeCodeRange[] => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const blanked = blankComments(code)
  const keyed = getStrudelFlowCodeOrder(nodes, edges).flatMap((nodeId) => {
    const node = nodesById.get(nodeId)
    const key = node === undefined ? null : readKey(node)
    return node === undefined || key === null
      ? []
      : [{ nodeId, key, id: keyId(key), count: occurrenceCount(node) }]
  })
  const callsById = Object.fromEntries(
    keyed.map((entry) => [entry.id, findCalls(blanked, entry.key)])
  )
  return keyed.flatMap((entry, position) => {
    const consumed = keyed
      .slice(0, position)
      .reduce((total, earlier) => total + (earlier.id === entry.id ? earlier.count : 0), 0)
    return (callsById[entry.id] ?? [])
      .slice(consumed, consumed + entry.count)
      .map((range) => ({ ...range, nodeId: entry.nodeId }))
  })
}

/**
 * Finds the code a node writes in the program.
 * @param code - the program in the code editor
 * @param nodes - the patch's nodes
 * @param edges - the patch's cables
 * @param nodeId - the node to find
 * @returns the range of the node's first call, or null when the code has no such call
 */
export const findStrudelFlowNodeCode = (
  code: string,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[],
  nodeId: string
): StrudelFlowCodeRange | null => {
  const found = getStrudelFlowNodeCodeRanges(code, nodes, edges).find(
    (range) => range.nodeId === nodeId
  )
  return found === undefined ? null : { from: found.from, to: found.to }
}

const leftmostRange = (ranges: StrudelFlowNodeCodeRange[]): StrudelFlowNodeCodeRange | null =>
  ranges.reduce<StrudelFlowNodeCodeRange | null>(
    (leftmost, range) => (leftmost === null || range.from < leftmost.from ? range : leftmost),
    null
  )

// Follows cables back from a node to the instruments that feed it; the guard stops a cycle.
const findUpstreamInstrumentIds = (
  nodesById: Map<string, StrudelFlowNode>,
  edges: StrudelFlowEdge[],
  nodeId: string,
  seen: string[] = []
): string[] => {
  const node = nodesById.get(nodeId)
  if (node === undefined || seen.includes(nodeId)) {
    return []
  }
  if (isStrudelFlowInstrumentKind(node.data.kind)) {
    return [nodeId]
  }
  const visited = [...seen, nodeId]
  return edges
    .filter((edge) => edge.target === nodeId)
    .flatMap((edge) => findUpstreamInstrumentIds(nodesById, edges, edge.source, visited))
}

/**
 * Finds the instruments a sounding note came from. A note carries a location for each piece of
 * mini-notation it was built from, in no reliable order, and a note held in a setup variable has
 * none in any node. Each offset is mapped to its node (the narrowest range wins); the leftmost
 * instrument among them owns the note, else the instruments upstream of the owners do, when
 * there is exactly one.
 * ponytail: a note whose mini-notation lives in a setup variable and passes through a shared
 * effect lights nothing; give the parser source offsets for setup variables to light it.
 * @param ranges - every node's code ranges
 * @param offsetsPerHap - for each sounding note, the character offsets of its locations
 * @param nodes - the patch's nodes
 * @param edges - the patch's cables
 * @returns the id of the instrument each note came from, once each
 */
export const findStrudelFlowPlayingNodeIds = (
  ranges: StrudelFlowNodeCodeRange[],
  offsetsPerHap: number[][],
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[]
): string[] => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const isInstrumentRange = (range: StrudelFlowNodeCodeRange): boolean => {
    const node = nodesById.get(range.nodeId)
    return node !== undefined && isStrudelFlowInstrumentKind(node.data.kind)
  }
  const narrowestOwner = (offset: number): StrudelFlowNodeCodeRange | null =>
    ranges
      .filter((range) => range.from <= offset && offset < range.to)
      .reduce<StrudelFlowNodeCodeRange | null>(
        (narrowest, range) =>
          narrowest === null || range.to - range.from < narrowest.to - narrowest.from
            ? range
            : narrowest,
        null
      )
  const headIds = offsetsPerHap.flatMap((offsets) => {
    const owners = offsets.flatMap((offset) => narrowestOwner(offset) ?? [])
    const instrument = leftmostRange(owners.filter(isInstrumentRange))
    if (instrument !== null) {
      return [instrument.nodeId]
    }
    const heads = [
      ...new Set(
        owners.flatMap((owner) => findUpstreamInstrumentIds(nodesById, edges, owner.nodeId))
      )
    ]
    return heads.length === 1 ? heads : []
  })
  return [...new Set(headIds)]
}
