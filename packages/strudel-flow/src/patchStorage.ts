import {
  STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE,
  STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
  STRUDEL_FLOW_MAX_BEATS_PER_MINUTE,
  STRUDEL_FLOW_MAX_NODE_COORDINATE,
  STRUDEL_FLOW_MIN_BEATS_PER_MINUTE
} from './config'
import { canConnectStrudelFlowNodes } from './connections'
import { isStrudelFlowNodeKind, readStrudelFlowNodeData } from './readStrudelFlowNodeData'
import { isStoredRecord, readStoredNumber, readStoredString } from './readStoredValue'
import { normalizeStrudelFlowBeatsPerCycle, normalizeStrudelFlowBeatsPerMinute } from './tempo'
import type { StrudelFlowEdge, StrudelFlowNode, StrudelFlowPatch } from './types'

const readNode = (value: unknown): StrudelFlowNode | null => {
  if (!isStoredRecord(value)) {
    return null
  }
  const id = readStoredString(value.id, '')
  const position = isStoredRecord(value.position) ? value.position : {}
  const data = isStoredRecord(value.data) ? value.data : {}
  if (id.length === 0 || !isStrudelFlowNodeKind(data.kind)) {
    return null
  }
  return {
    id,
    type: readStoredString(value.type, 'strudel'),
    position: {
      x: readStoredNumber(
        position.x,
        0,
        -STRUDEL_FLOW_MAX_NODE_COORDINATE,
        STRUDEL_FLOW_MAX_NODE_COORDINATE
      ),
      y: readStoredNumber(
        position.y,
        0,
        -STRUDEL_FLOW_MAX_NODE_COORDINATE,
        STRUDEL_FLOW_MAX_NODE_COORDINATE
      )
    },
    data: readStrudelFlowNodeData(data.kind, data)
  }
}

const readNodes = (value: unknown): StrudelFlowNode[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .flatMap((rawNode) => {
      const node = readNode(rawNode)
      return node === null ? [] : [node]
    })
    .reduce<StrudelFlowNode[]>(
      (nodes, node) =>
        nodes.some((existingNode) => existingNode.id === node.id) ? nodes : [...nodes, node],
      []
    )
}

const readEdgeId = (
  rawValue: Record<string, unknown>,
  source: string,
  target: string,
  edges: StrudelFlowEdge[]
): string => {
  const storedId = readStoredString(rawValue.id, '')
  if (storedId.length > 0 && !edges.some((edge) => edge.id === storedId)) {
    return storedId
  }
  return `${source}-${target}`
}

const readEdge = (
  value: unknown,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[]
): StrudelFlowEdge | null => {
  if (!isStoredRecord(value)) {
    return null
  }
  const source = readStoredString(value.source, '')
  const target = readStoredString(value.target, '')
  if (!canConnectStrudelFlowNodes(source, target, nodes, edges)) {
    return null
  }
  return {
    id: readEdgeId(value, source, target, edges),
    source,
    target
  }
}

const readEdges = (value: unknown, nodes: StrudelFlowNode[]): StrudelFlowEdge[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.reduce<StrudelFlowEdge[]>((edges, rawEdge) => {
    const edge = readEdge(rawEdge, nodes, edges)
    return edge === null ? edges : [...edges, edge]
  }, [])
}

/**
 * Reads a patch saved in local storage, rejecting anything a graph editor cannot use. Edges
 * that would not pass the canvas's own connection rules are dropped, so a hand-edited or
 * outdated stored patch still opens as a graph that compiles.
 * @param rawValue - the stored string, or null when nothing is stored
 * @returns a usable patch, or null when the stored value is absent or not a patch
 */
export const parseStrudelFlowPatch = (rawValue: string | null): StrudelFlowPatch | null => {
  if (rawValue === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(rawValue)
    if (!isStoredRecord(parsed) || !Array.isArray(parsed.nodes)) {
      return null
    }
    const nodes = readNodes(parsed.nodes)
    return {
      nodes,
      edges: readEdges(parsed.edges, nodes),
      beatsPerMinute: normalizeStrudelFlowBeatsPerMinute(
        readStoredNumber(
          parsed.beatsPerMinute,
          STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
          STRUDEL_FLOW_MIN_BEATS_PER_MINUTE,
          STRUDEL_FLOW_MAX_BEATS_PER_MINUTE
        )
      ),
      beatsPerCycle: normalizeStrudelFlowBeatsPerCycle(
        readStoredNumber(
          parsed.beatsPerCycle,
          STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE,
          1,
          STRUDEL_FLOW_MAX_BEATS_PER_MINUTE
        )
      ),
      setup: readStoredString(parsed.setup, '')
    }
  } catch {
    return null
  }
}
