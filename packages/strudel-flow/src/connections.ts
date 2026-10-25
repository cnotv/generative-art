import { isStrudelFlowInstrumentKind } from './nodeDefaults'
import type { StrudelFlowEdge, StrudelFlowNode } from './types'

/** The fields Vue Flow includes when it asks whether a cable or an edge is valid. */
export type StrudelFlowConnectionCandidate = {
  source?: string | null
  target?: string | null
  /** Set when this is an edge the graph already holds, not a cable being drawn. */
  id?: string
}

const hasDownstreamPath = (
  fromNodeId: string,
  toNodeId: string,
  edges: StrudelFlowEdge[],
  visitedNodeIds: string[] = []
): boolean => {
  if (fromNodeId === toNodeId) {
    return true
  }
  if (visitedNodeIds.includes(fromNodeId)) {
    return false
  }
  const nextVisitedNodeIds = [...visitedNodeIds, fromNodeId]
  return edges
    .filter((edge) => edge.source === fromNodeId)
    .some((edge) => hasDownstreamPath(edge.target, toNodeId, edges, nextVisitedNodeIds))
}

/**
 * Whether a cable can run from one node into another without turning the patch into something
 * the compiler has to reject: an instrument has no input, a pair connects once, and an effect
 * cannot feed back into a node upstream of itself.
 * @param sourceNodeId - the node the cable leaves
 * @param targetNodeId - the node the cable enters
 * @param nodes - every node in the patch
 * @param edges - every cable already in the patch
 * @returns true when the patch still compiles after adding the cable
 */
export const canConnectStrudelFlowNodes = (
  sourceNodeId: string,
  targetNodeId: string,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[]
): boolean => {
  if (sourceNodeId === targetNodeId) {
    return false
  }
  const sourceNode = nodes.find((node) => node.id === sourceNodeId)
  const targetNode = nodes.find((node) => node.id === targetNodeId)
  if (sourceNode === undefined || targetNode === undefined) {
    return false
  }
  if (isStrudelFlowInstrumentKind(targetNode.data.kind)) {
    return false
  }
  if (edges.some((edge) => edge.source === sourceNodeId && edge.target === targetNodeId)) {
    return false
  }
  return !hasDownstreamPath(targetNodeId, sourceNodeId, edges)
}

/**
 * Whether Vue Flow may keep the connection it is asking about. A cable being drawn follows the
 * patch rules. An edge handed back from the graph already passed those rules, so it is accepted
 * here; checking it again as a new cable would reject it as one of its own duplicates.
 * @param connection - the cable being drawn, or an edge the graph already holds
 * @param nodes - every node in the patch
 * @param edges - every cable already in the patch
 * @returns true when the graph may keep the connection
 */
export const canUseStrudelFlowConnection = (
  connection: StrudelFlowConnectionCandidate,
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[]
): boolean =>
  connection.id !== undefined ||
  canConnectStrudelFlowNodes(connection.source ?? '', connection.target ?? '', nodes, edges)
