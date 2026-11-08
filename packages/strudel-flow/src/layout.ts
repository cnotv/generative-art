import {
  STRUDEL_FLOW_NODE_COLUMN_GAP,
  STRUDEL_FLOW_NODE_COLUMNS,
  STRUDEL_FLOW_NODE_START_X,
  STRUDEL_FLOW_NODE_START_Y
} from './config'
import type {
  StrudelFlowNode,
  StrudelFlowNodeKind,
  StrudelFlowNodePosition,
  StrudelFlowNodeSize as NodeSize
} from './types'

// Heights before Vue Flow measures a node. They are generous because an overlap is much
// worse than a little empty space.
const DEFAULT_NODE_SIZE: NodeSize = { width: 448, height: 300 }
const NODE_SIZES: Record<StrudelFlowNodeKind, NodeSize> = {
  pad: { width: 448, height: 540 },
  beats: { width: 704, height: 320 },
  chords: { width: 416, height: 520 },
  notes: { width: 384, height: 440 },
  samples: { width: 480, height: 320 },
  code: { width: 448, height: 300 },
  voice: { width: 320, height: 240 },
  filter: { width: 448, height: 240 },
  delay: { width: 448, height: 240 },
  space: { width: 448, height: 460 },
  gain: { width: 256, height: 220 },
  level: { width: 320, height: 220 },
  mask: { width: 384, height: 240 },
  struct: { width: 384, height: 240 },
  slow: { width: 256, height: 220 },
  voicing: { width: 256, height: 140 },
  envelope: { width: 448, height: 260 },
  visualizer: { width: 384, height: 320 },
  effect: { width: 320, height: 220 }
}

const NODE_GAP = 32
const SEARCH_STEP = 40
const SEARCH_ROWS = 1000

/**
 * The size a node of this kind is laid out with before the canvas has measured it.
 * @param kind - the node kind
 * @returns its expected width and height
 */
export const getStrudelFlowNodeSize = (kind: StrudelFlowNodeKind): NodeSize =>
  NODE_SIZES[kind] ?? DEFAULT_NODE_SIZE

const sizeOf = (node: StrudelFlowNode): NodeSize => {
  const fallback = getStrudelFlowNodeSize(node.data.kind)
  return {
    width: node.dimensions?.width ?? fallback.width,
    height: node.dimensions?.height ?? fallback.height
  }
}

const overlaps = (
  left: StrudelFlowNodePosition & NodeSize,
  right: StrudelFlowNodePosition & NodeSize
): boolean =>
  left.x < right.x + right.width + NODE_GAP &&
  right.x < left.x + left.width + NODE_GAP &&
  left.y < right.y + right.height + NODE_GAP &&
  right.y < left.y + left.height + NODE_GAP

/**
 * Whether two nodes would be drawn on top of each other or closer than the canvas gap.
 * @param left - one node, at its position and measured or expected size
 * @param right - the other node
 * @returns true when their boxes, padded by the gap, intersect
 */
export const doStrudelFlowNodesOverlap = (left: StrudelFlowNode, right: StrudelFlowNode): boolean =>
  overlaps({ ...left.position, ...sizeOf(left) }, { ...right.position, ...sizeOf(right) })

/**
 * Finds the first free slot for a new node on the two-column canvas. Existing nodes keep
 * their positions, so adding a node near a tall pad or accordion never hides it underneath.
 * @param nodes - nodes already on the canvas
 * @param kind - the node that is about to be added
 * @returns a position that does not overlap any existing node
 */
export const findStrudelFlowNodePosition = (
  nodes: StrudelFlowNode[],
  kind: StrudelFlowNodeKind
): StrudelFlowNodePosition => {
  const size = getStrudelFlowNodeSize(kind)
  const isFree = (position: StrudelFlowNodePosition): boolean =>
    nodes.every(
      (node) => !overlaps({ ...position, ...size }, { ...node.position, ...sizeOf(node) })
    )
  const candidates = Array.from({ length: SEARCH_ROWS }, (_, row) =>
    Array.from({ length: STRUDEL_FLOW_NODE_COLUMNS }, (_, column) => ({
      x: STRUDEL_FLOW_NODE_START_X + column * STRUDEL_FLOW_NODE_COLUMN_GAP,
      y: STRUDEL_FLOW_NODE_START_Y + row * SEARCH_STEP
    }))
  ).flat()
  return candidates.find(isFree) ?? { x: STRUDEL_FLOW_NODE_START_X, y: STRUDEL_FLOW_NODE_START_Y }
}

const bottomOf = (node: StrudelFlowNode): number => node.position.y + sizeOf(node).height
const rightOf = (node: StrudelFlowNode): number => node.position.x + sizeOf(node).width

// Clears the blocker by the shorter of two moves: down under it, or right of it. A node stacked
// in a column goes down; a neighbour in the same row of the chain goes right.
const clearBlocker = (node: StrudelFlowNode, blocker: StrudelFlowNode): StrudelFlowNode => {
  const downBy = bottomOf(blocker) + NODE_GAP - node.position.y
  const rightBy = rightOf(blocker) + NODE_GAP - node.position.x
  return rightBy < downBy && node.position.x >= blocker.position.x
    ? { ...node, position: { ...node.position, x: node.position.x + rightBy } }
    : { ...node, position: { ...node.position, y: node.position.y + downBy } }
}

/**
 * Moves overlapping nodes apart using the sizes the canvas measured. The layout only knows a
 * node's expected size, and one with an open accordion or a long pattern renders larger, so
 * the node next to it would otherwise be drawn underneath.
 * @param nodes - nodes with their measured dimensions
 * @returns the nodes, each moved clear of whatever it overlapped, in the same order
 */
export const separateStrudelFlowNodes = (nodes: StrudelFlowNode[]): StrudelFlowNode[] => {
  const settled = [...nodes]
    .sort((left, right) => left.position.y - right.position.y || left.position.x - right.position.x)
    .reduce<StrudelFlowNode[]>((placed, node) => {
      const blocker = placed.find((other) => doStrudelFlowNodesOverlap(node, other))
      return [...placed, blocker === undefined ? node : clearBlocker(node, blocker)]
    }, [])
  return nodes.map((node) => settled.find((placed) => placed.id === node.id) ?? node)
}
