import { stripLineComments } from './codeScanner'
import { getStrudelFlowCodeOrder } from './compileStrudelFlow'
import { isStrudelFlowInstrumentKind } from './nodeDefaults'
import { generateStrudelFlowNodePattern } from './nodePatterns'
import type { StrudelFlowCodeRange, StrudelFlowEdge, StrudelFlowNode } from './types'

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
  const code = generateStrudelFlowNodePattern(
    { ...node.data, calls: [] },
    instrument ? '' : EFFECT_INPUT
  )
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
 * Finds the code a node writes in the program: the n-th call of its kind, counting the nodes of
 * the same kind before it in code order.
 * ponytail: matched by call name and position, not by parsing; a helper in the setup that makes
 * the same call shifts the count. Track source offsets in the parser if that ever matters.
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
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const node = nodesById.get(nodeId)
  const key = node === undefined ? null : readKey(node)
  if (key === null) {
    return null
  }
  const order = getStrudelFlowCodeOrder(nodes, edges)
  const position = order.indexOf(nodeId)
  const occurrence = order.slice(0, Math.max(0, position)).reduce((count, earlierId) => {
    const earlier = nodesById.get(earlierId)
    const earlierKey = earlier === undefined ? null : readKey(earlier)
    return earlier !== undefined && earlierKey !== null && keyId(earlierKey) === keyId(key)
      ? count + occurrenceCount(earlier)
      : count
  }, 0)
  const calls = findCalls(blankComments(code), key)
  return calls[occurrence] ?? calls[0] ?? null
}
