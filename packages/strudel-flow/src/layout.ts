/* eslint-disable functional/no-loop-statements -- a free-slot search reads clearer as two loops. */
import {
  STRUDEL_FLOW_NODE_COLUMN_GAP,
  STRUDEL_FLOW_NODE_COLUMNS,
  STRUDEL_FLOW_NODE_START_X,
  STRUDEL_FLOW_NODE_START_Y
} from './config'
import type { StrudelFlowNode, StrudelFlowNodeKind, StrudelFlowNodePosition } from './types'

type NodeSize = { width: number; height: number }

// Heights before Vue Flow measures a node. They are generous because an overlap is much
// worse than a little empty space.
const DEFAULT_NODE_SIZE: NodeSize = { width: 448, height: 300 }
const NODE_SIZES: Record<StrudelFlowNodeKind, NodeSize> = {
  pad: { width: 448, height: 540 },
  beats: { width: 448, height: 300 },
  chords: { width: 416, height: 520 },
  code: { width: 448, height: 300 },
  filter: { width: 448, height: 240 },
  delay: { width: 448, height: 240 },
  space: { width: 448, height: 460 },
  level: { width: 384, height: 260 },
  envelope: { width: 448, height: 260 },
  scope: { width: 320, height: 520 }
}

const NODE_GAP = 32
const SEARCH_STEP = 40

const sizeOf = (node: StrudelFlowNode): NodeSize => {
  const fallback = NODE_SIZES[node.data.kind] ?? DEFAULT_NODE_SIZE
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
  const size = NODE_SIZES[kind] ?? DEFAULT_NODE_SIZE
  for (let row = 0; row < 1000; row += 1) {
    const y = STRUDEL_FLOW_NODE_START_Y + row * SEARCH_STEP
    for (let column = 0; column < STRUDEL_FLOW_NODE_COLUMNS; column += 1) {
      const position = { x: STRUDEL_FLOW_NODE_START_X + column * STRUDEL_FLOW_NODE_COLUMN_GAP, y }
      if (
        nodes.every(
          (node) => !overlaps({ ...position, ...size }, { ...node.position, ...sizeOf(node) })
        )
      ) {
        return position
      }
    }
  }
  return { x: STRUDEL_FLOW_NODE_START_X, y: STRUDEL_FLOW_NODE_START_Y }
}
