import * as THREE from 'three'
import { HUMANOID_BONE_HIERARCHY } from './config'
import type { HumanoidBoneDefinition, HumanoidSkeleton } from './types'

/** +1 for a left-side bone, -1 for right, 0 down the centreline */
const resolveSideSign = (side: HumanoidBoneDefinition['side']): number =>
  side === 'left' ? 1 : side === 'right' ? -1 : 0

/** Where a template bone's joint sits in world space, scaled to the model's own bounding box */
const worldPositionFor = (definition: HumanoidBoneDefinition, box: THREE.Box3): THREE.Vector3 => {
  const height = box.max.y - box.min.y
  const halfWidth = (box.max.x - box.min.x) / 2
  const centerX = (box.max.x + box.min.x) / 2
  const centerZ = (box.max.z + box.min.z) / 2
  return new THREE.Vector3(
    centerX + resolveSideSign(definition.side) * definition.spreadFraction * halfWidth,
    box.min.y + definition.heightFraction * height,
    centerZ
  )
}

/**
 * Generate a canonical Mixamo-named humanoid skeleton, auto-fit to a model's bounding box.
 * A heuristic placement (proportion fractions, not an actual pose estimate), meant for models
 * that need a rig before they can be posed at all.
 * @param box The mesh's own bounding box, in its local space
 * @returns The generated bone hierarchy plus a bound-ready Skeleton
 */
export const rigGenerateHumanoidSkeleton = (box: THREE.Box3): HumanoidSkeleton => {
  const worldPositions = new Map<string, THREE.Vector3>(
    HUMANOID_BONE_HIERARCHY.map((definition) => [
      definition.name,
      worldPositionFor(definition, box)
    ])
  )
  const bonesByName = new Map<string, THREE.Bone>(
    HUMANOID_BONE_HIERARCHY.map((definition) => [
      definition.name,
      Object.assign(new THREE.Bone(), { name: definition.name })
    ])
  )

  HUMANOID_BONE_HIERARCHY.forEach((definition) => {
    const bone = bonesByName.get(definition.name) as THREE.Bone
    const worldPosition = worldPositions.get(definition.name) as THREE.Vector3
    const parentBone = definition.parent ? bonesByName.get(definition.parent) : undefined
    const parentWorldPosition = definition.parent
      ? worldPositions.get(definition.parent)
      : undefined

    if (parentBone && parentWorldPosition) {
      bone.position.copy(worldPosition).sub(parentWorldPosition)
      parentBone.add(bone)
    } else {
      bone.position.copy(worldPosition)
    }
  })

  const bones = HUMANOID_BONE_HIERARCHY.map(
    (definition) => bonesByName.get(definition.name) as THREE.Bone
  )
  const root = bones[0]
  root.updateMatrixWorld(true)

  return { root, bones, skeleton: new THREE.Skeleton(bones) }
}

const AUTO_SKIN_EPSILON = 1e-6

interface BoneSegment {
  index: number
  start: THREE.Vector3
  end: THREE.Vector3
}

/** Each bone's joint and its first child's joint, the segment a limb's mesh hugs */
const buildBoneSegments = (bones: THREE.Bone[]): BoneSegment[] =>
  bones.map((bone, index) => {
    const start = bone.getWorldPosition(new THREE.Vector3())
    const child = bone.children.find(
      (candidate): candidate is THREE.Bone => candidate instanceof THREE.Bone
    )
    const end = child ? child.getWorldPosition(new THREE.Vector3()) : start.clone()
    return { index, start, end }
  })

/** Shortest distance from a point to a bone's segment (its joint to its first child's joint) */
const distanceToSegment = (point: THREE.Vector3, segment: BoneSegment): number => {
  const direction = segment.end.clone().sub(segment.start)
  const lengthSquared = direction.lengthSq()
  if (lengthSquared < AUTO_SKIN_EPSILON) return point.distanceTo(segment.start)

  const t = THREE.MathUtils.clamp(
    point.clone().sub(segment.start).dot(direction) / lengthSquared,
    0,
    1
  )
  const closest = segment.start.clone().add(direction.multiplyScalar(t))
  return point.distanceTo(closest)
}

/** The mesh vertex sitting nearest (straight-line) to a bone's segment, to seed the graph search from. */
const nearestVertexToSegment = (segment: BoneSegment, positions: THREE.Vector3[]): number =>
  positions.reduce(
    (best, position, index) => {
      const distance = distanceToSegment(position, segment)
      return distance < best.distance ? { index, distance } : best
    },
    { index: 0, distance: Infinity }
  ).index

interface VertexGraph {
  positions: THREE.Vector3[]
  neighbors: number[][]
}

/** Triangle corner triples, from an indexed or a flat (three-vertices-per-face) geometry. */
const readTriangleIndices = (geometry: THREE.BufferGeometry): number[] =>
  geometry.index
    ? [...geometry.index.array]
    : Array.from({ length: geometry.attributes.position.count }, (_, index) => index)

/**
 * The mesh's own surface, as a vertex adjacency graph. Distance measured by walking this graph
 * follows the skin the way a heat-diffusion or bounded-biharmonic skinner would, rather than
 * cutting straight through the model's interior the way a plain Euclidean distance does: two
 * points across a narrow gap (an armpit and the chest below it, one finger and its neighbour)
 * read as close in straight-line distance but far apart once a path has to stay on the surface.
 * @param geometry The mesh geometry to build a graph over
 */
const buildVertexGraph = (geometry: THREE.BufferGeometry): VertexGraph => {
  const positionAttribute = geometry.attributes.position
  const positions = Array.from({ length: positionAttribute.count }, (_, index) =>
    new THREE.Vector3().fromBufferAttribute(positionAttribute, index)
  )
  const triangleIndices = readTriangleIndices(geometry)

  const edges = Array.from({ length: Math.floor(triangleIndices.length / 3) }, (_, face) => {
    const [a, b, c] = [
      triangleIndices[face * 3],
      triangleIndices[face * 3 + 1],
      triangleIndices[face * 3 + 2]
    ]
    return [
      [a, b],
      [b, c],
      [c, a]
    ]
  }).flat()

  const neighborSets = edges.reduce<Map<number, Set<number>>>((sets, [a, b]) => {
    const withA = new Map([...sets, [a, new Set([...(sets.get(a) ?? []), b])]])
    return new Map([...withA, [b, new Set([...(withA.get(b) ?? []), a])]])
  }, new Map())

  const neighbors = positions.map((_, index) => [...(neighborSets.get(index) ?? [])])

  return { positions, neighbors }
}

interface FrontierNode {
  vertexIndex: number
  boneIndex: number
  distance: number
}

type SettledVertices = Map<number, { boneIndex: number; distance: number }>

/** Extend the frontier with a settled node's unsettled neighbours, updating a shorter path in place. */
const relaxNeighbors = (
  current: FrontierNode,
  graph: VertexGraph,
  frontier: FrontierNode[],
  settled: SettledVertices
): FrontierNode[] =>
  graph.neighbors[current.vertexIndex].reduce<FrontierNode[]>((nextFrontier, neighborIndex) => {
    if (settled.has(neighborIndex)) return nextFrontier

    const edgeWeight = graph.positions[current.vertexIndex].distanceTo(
      graph.positions[neighborIndex]
    )
    const candidate: FrontierNode = {
      vertexIndex: neighborIndex,
      boneIndex: current.boneIndex,
      distance: current.distance + edgeWeight
    }
    const existingIndex = nextFrontier.findIndex((node) => node.vertexIndex === neighborIndex)

    if (existingIndex === -1) return [...nextFrontier, candidate]
    if (candidate.distance >= nextFrontier[existingIndex].distance) return nextFrontier
    return nextFrontier.map((node, index) => (index === existingIndex ? candidate : node))
  }, frontier)

interface GeodesicState {
  frontier: FrontierNode[]
  settled: SettledVertices
}

/** Settle the frontier's nearest node, the one Dijkstra step, expressed without mutation. */
const geodesicStep = (state: GeodesicState, graph: VertexGraph): GeodesicState => {
  if (state.frontier.length === 0) return state

  const current = state.frontier.reduce((best, node) =>
    node.distance < best.distance ? node : best
  )
  const remainingFrontier = state.frontier.filter((node) => node !== current)
  if (state.settled.has(current.vertexIndex))
    return { frontier: remainingFrontier, settled: state.settled }

  const settled: SettledVertices = new Map([
    ...state.settled,
    [current.vertexIndex, { boneIndex: current.boneIndex, distance: current.distance }]
  ])

  return { frontier: relaxNeighbors(current, graph, remainingFrontier, settled), settled }
}

/**
 * ponytail: an O(vertices^2) multi-source Dijkstra (linear scan for the frontier minimum,
 * matching this repo's own pathfinding style rather than a priority queue). Fine for the
 * low-poly meshes this tool targets; a binary heap would be the upgrade for a dense scan mesh.
 */
const runGeodesicMultiSource = (seeds: FrontierNode[], graph: VertexGraph): SettledVertices =>
  Array.from({ length: graph.positions.length }).reduce<GeodesicState>(
    (state) => geodesicStep(state, graph),
    { frontier: seeds, settled: new Map() }
  ).settled

const mostFrequent = (values: number[]): number => {
  const counts = values.reduce<Map<number, number>>(
    (accumulator, value) => new Map([...accumulator, [value, (accumulator.get(value) ?? 0) + 1]]),
    new Map()
  )
  return [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]
}

interface VertexWeights {
  indices: [number, number]
  weights: [number, number]
}

/**
 * Blend a settled vertex with a neighbouring bone only where its graph-neighbours disagree with
 * it, so a seam (elbow, shoulder) grades smoothly across the one or two rings of vertices
 * actually straddling it instead of every vertex committing fully to a single bone.
 */
const blendSettledVertex = (
  vertexIndex: number,
  settled: SettledVertices,
  neighbors: number[][]
): VertexWeights => {
  const own = settled.get(vertexIndex)
  const primaryBone = own?.boneIndex ?? 0
  const neighborList = neighbors[vertexIndex]

  const differingNeighborBones = neighborList
    .map((neighborIndex) => settled.get(neighborIndex)?.boneIndex)
    .filter(
      (boneIndex): boneIndex is number => boneIndex !== undefined && boneIndex !== primaryBone
    )

  if (differingNeighborBones.length === 0 || neighborList.length === 0) {
    return { indices: [primaryBone, primaryBone], weights: [1, 0] }
  }

  const secondaryBone = mostFrequent(differingNeighborBones)
  const secondaryWeight = differingNeighborBones.length / neighborList.length

  return {
    indices: [primaryBone, secondaryBone],
    weights: [1 - secondaryWeight, secondaryWeight]
  }
}

/** Euclidean nearest-two-bones fallback, for a vertex the surface graph search never reached (an isolated mesh island disconnected from every bone seed). */
const weighByStraightLineDistance = (
  point: THREE.Vector3,
  segments: BoneSegment[]
): VertexWeights => {
  const ranked = segments
    .map((segment) => ({ index: segment.index, distance: distanceToSegment(point, segment) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2)

  const inverseDistances = ranked.map((entry) => 1 / (entry.distance + AUTO_SKIN_EPSILON))
  const total = inverseDistances.reduce((sum, value) => sum + value, 0)

  return {
    indices: [ranked[0].index, ranked[1]?.index ?? ranked[0].index],
    weights: [inverseDistances[0] / total, (inverseDistances[1] ?? 0) / total]
  }
}

/**
 * Bind every vertex in a geometry to its two nearest bones, following the mesh's own surface
 * rather than a straight line through it, so a mesh that was never skinned can be posed by a
 * generated skeleton.
 * @param geometry The geometry to skin in place, adding skinIndex and skinWeight attributes
 * @param bones The skeleton's bones, in skeleton order, with up-to-date world matrices
 */
export const rigAutoSkinMesh = (geometry: THREE.BufferGeometry, bones: THREE.Bone[]): void => {
  const segments = buildBoneSegments(bones)
  const graph = buildVertexGraph(geometry)

  const seeds: FrontierNode[] = segments.map((segment) => ({
    vertexIndex: nearestVertexToSegment(segment, graph.positions),
    boneIndex: segment.index,
    distance: 0
  }))

  const settled = runGeodesicMultiSource(seeds, graph)

  const perVertexWeights = graph.positions.map((point, vertexIndex) =>
    settled.has(vertexIndex)
      ? blendSettledVertex(vertexIndex, settled, graph.neighbors)
      : weighByStraightLineDistance(point, segments)
  )

  const skinIndices = perVertexWeights.flatMap(({ indices }) => [indices[0], indices[1], 0, 0])
  const skinWeights = perVertexWeights.flatMap(({ weights }) => [weights[0], weights[1], 0, 0])

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
}
