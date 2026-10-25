import { isStrudelFlowInstrumentKind } from './nodeDefaults'
import { generateStrudelFlowNodePattern } from './nodePatterns'
import { normalizeStrudelFlowBeatsPerMinute } from './tempo'
import type {
  StrudelFlowCompilation,
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowPatch
} from './types'

type OrderState = {
  visiting: string[]
  visited: string[]
  ordered: string[]
  hasCycle: boolean
}

const EMPTY_ORDER: OrderState = {
  visiting: [],
  visited: [],
  ordered: [],
  hasCycle: false
}

const buildNeighbourMap = (edges: StrudelFlowEdge[]): Map<string, string[]> =>
  edges.reduce((neighbours, edge) => {
    const sourceNeighbours = neighbours.get(edge.source) ?? []
    const targetNeighbours = neighbours.get(edge.target) ?? []
    return new Map([
      ...neighbours,
      [edge.source, [...sourceNeighbours, edge.target]],
      [edge.target, [...targetNeighbours, edge.source]]
    ])
  }, new Map<string, string[]>())

const buildOutgoingMap = (
  edges: StrudelFlowEdge[],
  componentIds: string[]
): Map<string, string[]> =>
  edges.reduce((outgoing, edge) => {
    if (!componentIds.includes(edge.source) || !componentIds.includes(edge.target)) {
      return outgoing
    }
    return new Map([
      ...outgoing,
      [edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]]
    ])
  }, new Map<string, string[]>())

const collectComponent = (
  nodeId: string,
  neighbours: Map<string, string[]>,
  visited: string[]
): { component: string[]; visited: string[] } => {
  if (visited.includes(nodeId)) {
    return { component: [], visited }
  }
  const nextVisited = [...visited, nodeId]
  return (neighbours.get(nodeId) ?? []).reduce(
    (collected, neighbour) => {
      const downstream = collectComponent(neighbour, neighbours, collected.visited)
      return {
        component: [...collected.component, ...downstream.component],
        visited: downstream.visited
      }
    },
    { component: [nodeId], visited: nextVisited }
  )
}

const findComponents = (nodes: StrudelFlowNode[], edges: StrudelFlowEdge[]): string[][] => {
  const neighbours = buildNeighbourMap(edges)
  return nodes.reduce(
    (result, node) => {
      if (result.visited.includes(node.id)) {
        return result
      }
      const collected = collectComponent(node.id, neighbours, result.visited)
      return {
        components: [...result.components, collected.component],
        visited: collected.visited
      }
    },
    { components: [] as string[][], visited: [] as string[] }
  ).components
}

const visitInSignalOrder = (
  nodeId: string,
  outgoing: Map<string, string[]>,
  state: OrderState
): OrderState => {
  if (state.visiting.includes(nodeId)) {
    return { ...state, hasCycle: true }
  }
  if (state.visited.includes(nodeId)) {
    return state
  }
  const entered = { ...state, visiting: [...state.visiting, nodeId] }
  const afterChildren = (outgoing.get(nodeId) ?? []).reduce(
    (current, target) => visitInSignalOrder(target, outgoing, current),
    entered
  )
  return {
    visiting: afterChildren.visiting.filter((visitingId) => visitingId !== nodeId),
    visited: [...afterChildren.visited, nodeId],
    ordered: [nodeId, ...afterChildren.ordered],
    hasCycle: afterChildren.hasCycle
  }
}

const orderComponent = (componentIds: string[], edges: StrudelFlowEdge[]): OrderState => {
  const outgoing = buildOutgoingMap(edges, componentIds)
  return componentIds.reduce(
    (state, nodeId) => visitInSignalOrder(nodeId, outgoing, state),
    EMPTY_ORDER
  )
}

const findEffectIntoInstrument = (
  edges: StrudelFlowEdge[],
  nodesById: Map<string, StrudelFlowNode>
): StrudelFlowEdge | undefined =>
  edges.find((edge) => {
    const target = nodesById.get(edge.target)
    return target !== undefined && isStrudelFlowInstrumentKind(target.data.kind)
  })

const patternsForComponent = (
  componentIds: string[],
  nodesById: Map<string, StrudelFlowNode>
): string[] =>
  componentIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is StrudelFlowNode => node !== undefined)
    .filter((node) => isStrudelFlowInstrumentKind(node.data.kind))
    .map((node) => generateStrudelFlowNodePattern(node.data, ''))
    .filter((pattern) => pattern.length > 0)

const stackPatterns = (patterns: string[]): string =>
  patterns.length === 1 ? patterns[0] : `stack(${patterns.join(', ')})`

const applyEffects = (
  pattern: string,
  componentIds: string[],
  orderedIds: string[],
  nodesById: Map<string, StrudelFlowNode>
): string =>
  orderedIds.reduce((currentPattern, nodeId) => {
    const node = nodesById.get(nodeId)
    if (node === undefined || !componentIds.includes(nodeId)) {
      return currentPattern
    }
    return isStrudelFlowInstrumentKind(node.data.kind)
      ? currentPattern
      : generateStrudelFlowNodePattern(node.data, currentPattern)
  }, pattern)

const compileComponents = (
  components: string[][],
  edges: StrudelFlowEdge[],
  nodesById: Map<string, StrudelFlowNode>
): string[] =>
  components.flatMap((componentIds) => {
    const patterns = patternsForComponent(componentIds, nodesById)
    if (patterns.length === 0) {
      return []
    }
    const order = orderComponent(componentIds, edges)
    return [`$: ${applyEffects(stackPatterns(patterns), componentIds, order.ordered, nodesById)}`]
  })

/**
 * Turns a flow patch into one Strudel program: a tempo, then one `$:` block per connected
 * component. A component stacks its instruments and chains every effect in signal order,
 * because Strudel has no per-branch effect graph of its own.
 * @param patch - the nodes, edges and tempo to compile
 * @returns the program, or the reason it cannot be played
 */
export const compileStrudelFlow = (patch: StrudelFlowPatch): StrudelFlowCompilation => {
  const nodesById = new Map(patch.nodes.map((node) => [node.id, node]))
  if (findEffectIntoInstrument(patch.edges, nodesById) !== undefined) {
    return {
      code: '',
      errorMessage:
        'An instrument cannot take an input. Connect the effect to another effect instead.'
    }
  }
  if (!patch.nodes.some((node) => isStrudelFlowInstrumentKind(node.data.kind))) {
    return {
      code: '',
      errorMessage: 'Add an instrument node such as Pad, Beats, Chords or Code to start a pattern.'
    }
  }
  const components = findComponents(patch.nodes, patch.edges)
  const cyclicComponent = components.find(
    (componentIds) => orderComponent(componentIds, patch.edges).hasCycle
  )
  if (cyclicComponent !== undefined) {
    return {
      code: '',
      errorMessage: 'Remove the loop from the flow: an effect cannot feed back into itself.'
    }
  }
  const blocks = compileComponents(components, patch.edges, nodesById)
  if (blocks.length === 0) {
    return {
      code: '',
      errorMessage:
        'The flow makes no sound yet. Turn on a drum step, add notes, or write an expression.'
    }
  }
  return {
    code: [`setcpm(${normalizeStrudelFlowBeatsPerMinute(patch.beatsPerMinute)}/4)`, ...blocks].join(
      '\n'
    ),
    errorMessage: null
  }
}
