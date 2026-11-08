import { isStrudelFlowInstrumentKind } from './nodeDefaults'
import type { StrudelFlowEdge, StrudelFlowNode } from './types'

const isInstrument = (node: StrudelFlowNode): boolean => isStrudelFlowInstrumentKind(node.data.kind)

const isInstrumentMuted = (node: StrudelFlowNode): boolean =>
  'muted' in node.data && node.data.muted === true

const neighboursOf = (nodeId: string, edges: StrudelFlowEdge[]): string[] =>
  edges.flatMap((edge) => {
    if (edge.source === nodeId) {
      return [edge.target]
    }
    return edge.target === nodeId ? [edge.source] : []
  })

const connectedIds = (startId: string, edges: StrudelFlowEdge[], seen: string[] = []): string[] =>
  seen.includes(startId)
    ? seen
    : neighboursOf(startId, edges).reduce(
        (found, neighbourId) => connectedIds(neighbourId, edges, found),
        [...seen, startId]
      )

// An instrument solos itself. A voice plays through the instruments wired to it, so those are
// what soloing the voice keeps playing.
const instrumentsToKeep = (
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[],
  nodeId: string
): string[] => {
  const target = nodes.find((node) => node.id === nodeId)
  if (target === undefined) {
    return []
  }
  if (isInstrument(target)) {
    return [nodeId]
  }
  const component = connectedIds(nodeId, edges)
  return nodes
    .filter((node) => isInstrument(node) && component.includes(node.id))
    .map(({ id }) => id)
}

/**
 * Whether the instruments behind a node are the only ones left playing, which is what Solo
 * leaves behind.
 * @param nodes - every node on the canvas
 * @param edges - every cable
 * @param nodeId - the instrument or voice to test
 * @returns true when those instruments play and every other instrument is muted
 */
export const isStrudelFlowSoloed = (
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[],
  nodeId: string
): boolean => {
  const kept = instrumentsToKeep(nodes, edges, nodeId)
  const instruments = nodes.filter(isInstrument)
  return (
    kept.length > 0 &&
    instruments.length > kept.length &&
    instruments.every((node) => kept.includes(node.id) !== isInstrumentMuted(node))
  )
}

/**
 * The mute changes that solo an instrument or a voice, or end the solo when it is already on.
 * Solo is the existing mute flag on every instrument, so the code, the saved flow and playback
 * need no second state to agree on.
 * @param nodes - every node on the canvas
 * @param edges - every cable
 * @param nodeId - the instrument or voice that was soloed
 * @returns the instruments whose muted flag has to change, with the value it takes
 */
export const planStrudelFlowSolo = (
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[],
  nodeId: string
): { nodeId: string; muted: boolean }[] => {
  const kept = instrumentsToKeep(nodes, edges, nodeId)
  const endsSolo = isStrudelFlowSoloed(nodes, edges, nodeId)
  return nodes
    .filter(isInstrument)
    .map((node) => ({ node, muted: endsSolo ? false : !kept.includes(node.id) }))
    .filter(({ node, muted }) => isInstrumentMuted(node) !== muted)
    .map(({ node, muted }) => ({ nodeId: node.id, muted }))
}
