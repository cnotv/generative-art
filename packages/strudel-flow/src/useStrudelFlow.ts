import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { readStorage, writeStorage } from './storage'
import { compileStrudelFlow } from './compileStrudelFlow'
import { STRUDEL_FLOW_PATCH_STORAGE_KEY } from './config'
import { canConnectStrudelFlowNodes } from './connections'
import { createDefaultStrudelFlowPatch } from './defaultPatch'
import { findStrudelFlowNodePosition } from './layout'
import { createStrudelFlowNodeData } from './nodeDefaults'
import { parseStrudelFlowPatch } from './patchStorage'
import { parseStrudelFlowCode } from './parseStrudelFlowCode'
import { normalizeStrudelFlowBeatsPerMinute } from './tempo'
import type {
  StrudelFlowCompilation,
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowNodeData,
  StrudelFlowNodeKind,
  StrudelFlowPatch
} from './types'

export type StrudelFlowState = {
  nodes: Ref<StrudelFlowNode[]>
  edges: Ref<StrudelFlowEdge[]>
  beatsPerMinute: Ref<number>
  compilation: ComputedRef<StrudelFlowCompilation>
  addNode: (kind: StrudelFlowNodeKind) => void
  updateNodeData: (nodeId: string, data: StrudelFlowNodeData) => void
  removeNode: (nodeId: string) => void
  /** Adds a cable when the same connection rules the canvas uses allow it. */
  connectNodes: (sourceNodeId: string, targetNodeId: string) => boolean
  setBeatsPerMinute: (beatsPerMinute: number) => void
  resetPatch: () => void
  /** Rebuilds the graph from code, reusing node positions where it can. */
  loadCode: (code: string) => void
}

const readInitialPatch = (): StrudelFlowPatch =>
  parseStrudelFlowPatch(readStorage(STRUDEL_FLOW_PATCH_STORAGE_KEY)) ??
  createDefaultStrudelFlowPatch()

const nextNodeId = (kind: StrudelFlowNodeKind, nodes: StrudelFlowNode[], index: number): string =>
  nodes.some((node) => node.id === `${kind}-${index}`)
    ? nextNodeId(kind, nodes, index + 1)
    : `${kind}-${index}`

// The canvas adds layout details to the nodes and edges it is given. Only the patch itself is
// worth storing, so a saved graph stays small and free of canvas internals.
const toStoredPatch = (
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[],
  beatsPerMinute: number
): StrudelFlowPatch => ({
  nodes: nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    data: node.data
  })),
  edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  beatsPerMinute
})

/**
 * The node canvas state: the patch, its tempo, the code it compiles to, and the edits a
 * palette or canvas makes. Every change is written to local storage, and an invalid cable is
 * refused here as well as on the canvas.
 * @returns the patch, its compilation, and the actions that change it
 */
export const useStrudelFlow = (): StrudelFlowState => {
  const initialPatch = readInitialPatch()
  const nodes = ref<StrudelFlowNode[]>(initialPatch.nodes)
  const edges = ref<StrudelFlowEdge[]>(initialPatch.edges)
  const beatsPerMinute = ref(initialPatch.beatsPerMinute)

  const compilation = computed<StrudelFlowCompilation>(() =>
    compileStrudelFlow({
      nodes: nodes.value,
      edges: edges.value,
      beatsPerMinute: beatsPerMinute.value
    })
  )

  const addNode = (kind: StrudelFlowNodeKind): void => {
    nodes.value = [
      ...nodes.value,
      {
        id: nextNodeId(kind, nodes.value, 1),
        type: 'strudel',
        position: findStrudelFlowNodePosition(nodes.value, kind),
        data: createStrudelFlowNodeData(kind)
      }
    ]
  }

  const updateNodeData = (nodeId: string, data: StrudelFlowNodeData): void => {
    nodes.value = nodes.value.map((node) => (node.id === nodeId ? { ...node, data } : node))
  }

  const removeNode = (nodeId: string): void => {
    nodes.value = nodes.value.filter((node) => node.id !== nodeId)
    edges.value = edges.value.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
  }

  const connectNodes = (sourceNodeId: string, targetNodeId: string): boolean => {
    if (!canConnectStrudelFlowNodes(sourceNodeId, targetNodeId, nodes.value, edges.value)) {
      return false
    }
    edges.value = [
      ...edges.value,
      {
        id: `${sourceNodeId}-${targetNodeId}`,
        source: sourceNodeId,
        target: targetNodeId
      }
    ]
    return true
  }

  const setBeatsPerMinute = (nextBeatsPerMinute: number): void => {
    beatsPerMinute.value = normalizeStrudelFlowBeatsPerMinute(nextBeatsPerMinute)
  }

  const resetPatch = (): void => {
    const defaultPatch = createDefaultStrudelFlowPatch()
    nodes.value = defaultPatch.nodes
    edges.value = defaultPatch.edges
    beatsPerMinute.value = defaultPatch.beatsPerMinute
  }

  const loadCode = (code: string): void => {
    const patch = parseStrudelFlowCode(code, nodes.value)
    if (patch === null) {
      return
    }
    nodes.value = patch.nodes
    edges.value = patch.edges
    beatsPerMinute.value = patch.beatsPerMinute
  }

  watch(
    [nodes, edges, beatsPerMinute],
    () => {
      writeStorage(
        STRUDEL_FLOW_PATCH_STORAGE_KEY,
        JSON.stringify(toStoredPatch(nodes.value, edges.value, beatsPerMinute.value))
      )
    },
    { deep: true }
  )

  return {
    nodes,
    edges,
    beatsPerMinute,
    compilation,
    addNode,
    updateNodeData,
    removeNode,
    connectNodes,
    setBeatsPerMinute,
    resetPatch,
    loadCode
  }
}
