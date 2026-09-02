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
    HUMANOID_BONE_HIERARCHY.map((definition) => {
      const bone = new THREE.Bone()
      bone.name = definition.name
      return [definition.name, bone]
    })
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

const AUTO_SKIN_MAX_INFLUENCES = 2
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

/**
 * ponytail: weights a vertex by inverse distance to the nearest two bone segments, not a real
 * heat-diffusion skin. Upgrade to a bind-pose heat-map weighter if generated skins pinch
 * visibly at joints.
 */
const weighVertex = (
  point: THREE.Vector3,
  segments: BoneSegment[]
): { indices: [number, number]; weights: [number, number] } => {
  const ranked = segments
    .map((segment) => ({ index: segment.index, distance: distanceToSegment(point, segment) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, AUTO_SKIN_MAX_INFLUENCES)

  const inverseDistances = ranked.map((entry) => 1 / (entry.distance + AUTO_SKIN_EPSILON))
  const total = inverseDistances.reduce((sum, value) => sum + value, 0)

  return {
    indices: [ranked[0].index, ranked[1]?.index ?? ranked[0].index],
    weights: [inverseDistances[0] / total, (inverseDistances[1] ?? 0) / total]
  }
}

/**
 * Bind every vertex in a geometry to its two nearest bones by proximity, so a mesh that was
 * never skinned can be posed by a generated skeleton.
 * @param geometry The geometry to skin in place, adding skinIndex and skinWeight attributes
 * @param bones The skeleton's bones, in skeleton order, with up-to-date world matrices
 */
export const rigAutoSkinMesh = (geometry: THREE.BufferGeometry, bones: THREE.Bone[]): void => {
  const segments = buildBoneSegments(bones)
  const positionAttribute = geometry.attributes.position
  const vertex = new THREE.Vector3()

  const perVertexWeights = Array.from({ length: positionAttribute.count }, (_, index) => {
    vertex.fromBufferAttribute(positionAttribute, index)
    return weighVertex(vertex, segments)
  })

  const skinIndices = perVertexWeights.flatMap(({ indices }) => [indices[0], indices[1], 0, 0])
  const skinWeights = perVertexWeights.flatMap(({ weights }) => [weights[0], weights[1], 0, 0])

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
}
