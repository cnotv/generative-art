import { isStrudelFlowInstrumentKind } from './nodeDefaults'
import { generateStrudelFlowNodePattern } from './nodePatterns'
import { normalizeStrudelFlowBeatsPerCycle, normalizeStrudelFlowBeatsPerMinute } from './tempo'
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

const isMuted = (node: StrudelFlowNode): boolean => 'muted' in node.data && node.data.muted === true

const instrumentsInComponent = (
  componentIds: string[],
  nodesById: Map<string, StrudelFlowNode>
): StrudelFlowNode[] =>
  componentIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is StrudelFlowNode => node !== undefined)
    .filter((node) => isStrudelFlowInstrumentKind(node.data.kind))

const collectDownstream = (
  nodeId: string,
  outgoing: Map<string, string[]>,
  reached: string[]
): string[] =>
  (outgoing.get(nodeId) ?? []).reduce(
    (collected, target) =>
      collected.includes(target)
        ? collected
        : collectDownstream(target, outgoing, [...collected, target]),
    reached
  )

const commonSuffixLength = (lists: string[][]): number => {
  const shortest = Math.min(...lists.map((list) => list.length))
  return (
    Array.from({ length: shortest }, (_, offset) => offset + 1).findLast((length) =>
      lists.every((list) => list.slice(-length).join() === lists[0].slice(-length).join())
    ) ?? 0
  )
}

const applyEffects = (
  pattern: string,
  effectIds: string[],
  nodesById: Map<string, StrudelFlowNode>
): string =>
  effectIds.reduce((currentPattern, nodeId) => {
    const node = nodesById.get(nodeId)
    return node === undefined
      ? currentPattern
      : generateStrudelFlowNodePattern(node.data, currentPattern)
  }, pattern)

type InstrumentPath = { pattern: string; effectIds: string[] }

// Each instrument only goes through the effects downstream of it. The effects every path shares
// are chained once after the stack; the rest stay on their own branch inside it.
const compileComponent = (
  componentIds: string[],
  edges: StrudelFlowEdge[],
  nodesById: Map<string, StrudelFlowNode>
): string[] => {
  const instruments = instrumentsInComponent(componentIds, nodesById)
  const isComponentMuted = instruments.length > 0 && instruments.every(isMuted)
  const outgoing = buildOutgoingMap(edges, componentIds)
  const ordered = orderComponent(componentIds, edges).ordered
  const paths: InstrumentPath[] = instruments.flatMap((node) => {
    const pattern = generateStrudelFlowNodePattern(node.data, '')
    if (pattern.length === 0) {
      return []
    }
    const downstream = collectDownstream(node.id, outgoing, [])
    return [
      {
        pattern: !isComponentMuted && isMuted(node) ? `${pattern}.hush()` : pattern,
        effectIds: ordered.filter((nodeId) => downstream.includes(nodeId))
      }
    ]
  })
  if (paths.length === 0) {
    return []
  }
  const sharedLength = commonSuffixLength(paths.map((path) => path.effectIds))
  const sharedIds = paths[0].effectIds.slice(paths[0].effectIds.length - sharedLength)
  const branches = paths.map((path) =>
    applyEffects(
      path.pattern,
      path.effectIds.slice(0, path.effectIds.length - sharedLength),
      nodesById
    )
  )
  const label = isComponentMuted ? '_$:' : '$:'
  return [`${label} ${applyEffects(stackPatterns(branches), sharedIds, nodesById)}`]
}

const stackPatterns = (patterns: string[]): string =>
  patterns.length === 1 ? patterns[0] : `stack(${patterns.join(', ')})`

const compileComponents = (
  components: string[][],
  edges: StrudelFlowEdge[],
  nodesById: Map<string, StrudelFlowNode>
): string[] =>
  components.flatMap((componentIds) => compileComponent(componentIds, edges, nodesById))

/**
 * Turns a flow patch into one Strudel program: a tempo, the setup statements, then one `$:` block per connected
 * component. A component stacks its instruments; each one passes only through the effects
 * downstream of it, and the effects every instrument shares are chained once after the stack.
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
  const tempo = `setcpm(${normalizeStrudelFlowBeatsPerMinute(patch.beatsPerMinute)}/${normalizeStrudelFlowBeatsPerCycle(patch.beatsPerCycle)})`
  const setup = patch.setup.trim()
  return {
    code: [tempo, ...(setup.length > 0 ? [setup] : []), ...blocks].join('\n'),
    errorMessage: null
  }
}
