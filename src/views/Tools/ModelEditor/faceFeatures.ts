import * as THREE from 'three'
import { resolveHierarchyBones } from '@/views/Tools/RigAnimator/rigModel'
import { canonicalBoneName } from './bodyParts'
import {
  FACE_CROWN_BONE,
  FACE_FALLOFF_CORE,
  FACE_FEATURES,
  FACE_HEAD_BONE,
  FACE_SNAP_WINDOW
} from './config'
import type {
  FaceAnchor,
  FaceFeature,
  FaceFeatureName,
  FaceFeatureSettings,
  FaceFrame,
  FaceMeshRig,
  FaceVertex,
  HeadVertex
} from './types'

/**
 * ponytail: the face is assumed to look down +Z with +Y up, the convention of both Mixamo and
 * glTF. A model authored facing another way gets its features snapped onto the back or side of
 * its head; reading the facing from the rig's own hips and shoulders is the upgrade.
 */
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const WORLD_FRONT = new THREE.Vector3(0, 0, 1)
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0)

const SKIN_COMPONENTS = [0, 1, 2, 3]

const scratchOffset = new THREE.Vector3()
const scratchMoved = new THREE.Vector3()

const RADIUS_BY_FEATURE = new Map(FACE_FEATURES.map((feature) => [feature.name, feature.radius]))

/**
 * A face left exactly as it was authored.
 * @returns A fresh set of per-feature settings, safe to mutate
 */
export const createFaceSettings = (): FaceFeatureSettings =>
  Object.fromEntries(
    FACE_FEATURES.map((feature) => [feature.name, { size: 1, height: 0, depth: 0 }])
  ) as FaceFeatureSettings

const findBone = (bones: THREE.Bone[], name: string): THREE.Bone | undefined =>
  bones.find((bone) => canonicalBoneName(bone.name) === name)

const ancestorsOf = (object: THREE.Object3D): THREE.Object3D[] =>
  object.parent ? [object.parent, ...ancestorsOf(object.parent)] : []

/** The joint a vertex follows most, out of the four a skinned vertex can carry. */
const dominantJoint = (geometry: THREE.BufferGeometry, vertexIndex: number): number => {
  const { skinIndex, skinWeight } = geometry.attributes
  const strongest = SKIN_COMPONENTS.reduce((best, component) =>
    skinWeight.getComponent(vertexIndex, component) > skinWeight.getComponent(vertexIndex, best)
      ? component
      : best
  )
  return skinIndex.getComponent(vertexIndex, strongest)
}

/** Every joint in a skinned mesh's skeleton that is the head or a bone hung below it. */
const headJointsOf = (mesh: THREE.SkinnedMesh, headBones: Set<THREE.Object3D>): number[] =>
  resolveHierarchyBones(mesh.skeleton.bones).flatMap((bone, joint) =>
    headBones.has(bone) ? [joint] : []
  )

/**
 * Which of a mesh's vertices belong to the head: those a skinned mesh binds mostly to the head's
 * bones, or every vertex of a plain mesh hung below the head, the way separate eyes often are.
 */
const headVertexIndices = (mesh: THREE.Mesh, headBones: Set<THREE.Object3D>): number[] => {
  const allIndices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i)
  if (mesh instanceof THREE.SkinnedMesh) {
    const headJoints = new Set(headJointsOf(mesh, headBones))
    return headJoints.size > 0
      ? allIndices.filter((index) => headJoints.has(dominantJoint(mesh.geometry, index)))
      : []
  }
  return ancestorsOf(mesh).some((ancestor) => headBones.has(ancestor)) ? allIndices : []
}

const headVerticesOf = (mesh: THREE.Mesh, headBones: Set<THREE.Object3D>): HeadVertex[] =>
  headVertexIndices(mesh, headBones).map((index) => ({
    mesh,
    index,
    world: mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
  }))

/**
 * The face's own extent: its centre line through the head bone, its chin at the lowest head
 * vertex, and its height up to the top of the skull. The skull's end bone marks that top where
 * the rig has one, since hair, hats and headphones would otherwise stretch the face to reach
 * them and push every feature down.
 */
const measureFaceFrame = (
  vertices: HeadVertex[],
  head: THREE.Bone,
  crown: THREE.Bone | undefined
): FaceFrame => {
  const headPosition = head.getWorldPosition(new THREE.Vector3())
  const heights = vertices.map((vertex) => vertex.world.y)
  const chin = heights.reduce((lowest, height) => Math.min(lowest, height), Infinity)
  const top = crown
    ? crown.getWorldPosition(new THREE.Vector3()).y
    : heights.reduce((highest, height) => Math.max(highest, height), -Infinity)
  return { centerX: headPosition.x, centerZ: headPosition.z, chin, height: top - chin }
}

/** The line each copy of a feature is searched along: from inside the head, facing outwards. */
const featureRays = (
  feature: FaceFeature,
  frame: FaceFrame
): { base: THREE.Vector3; outward: THREE.Vector3 }[] => {
  const height = frame.chin + feature.up * frame.height
  if (feature.facing === 'side') {
    return [1, -1].map((side) => ({
      base: new THREE.Vector3(frame.centerX, height, frame.centerZ),
      outward: WORLD_RIGHT.clone().multiplyScalar(side)
    }))
  }
  const acrossOffsets = feature.across > 0 ? [feature.across, -feature.across] : [0]
  return acrossOffsets.map((across) => ({
    base: new THREE.Vector3(frame.centerX + across * frame.height, height, frame.centerZ),
    outward: WORLD_FRONT.clone()
  }))
}

/**
 * The outermost head vertex along a ray, among those lying close to it: the point where the ray
 * leaves the skin. Features are placed by proportion, which gets their height and spacing about
 * right on most heads but knows nothing about how far forward a given face sits.
 */
const snapOntoSurface = (
  base: THREE.Vector3,
  outward: THREE.Vector3,
  vertices: HeadVertex[],
  snapWindow: number
): THREE.Vector3 | null => {
  const reach = vertices.reduce<number | null>((furthest, { world }) => {
    const along = scratchOffset.copy(world).sub(base).dot(outward)
    const distanceFromRay = scratchOffset.addScaledVector(outward, -along).length()
    return distanceFromRay < snapWindow && along > (furthest ?? -Infinity) ? along : furthest
  }, null)
  return reach === null ? null : base.clone().addScaledVector(outward, reach)
}

const findFaceAnchors = (vertices: HeadVertex[], frame: FaceFrame): FaceAnchor[] =>
  FACE_FEATURES.flatMap((feature) =>
    featureRays(feature, frame).flatMap(({ base, outward }) => {
      const position = snapOntoSurface(base, outward, vertices, FACE_SNAP_WINDOW * frame.height)
      return position ? [{ feature: feature.name, position, outward }] : []
    })
  )

/**
 * The map from a mesh's own geometry out to the world at rest. A plain mesh's is its world
 * matrix; a skinned mesh's runs through its bind and the head joint, so a displacement worked
 * out in the world lands on the right geometry however the rig was bound.
 */
const geometryToWorld = (mesh: THREE.Mesh, headBones: Set<THREE.Object3D>): THREE.Matrix4 => {
  if (!(mesh instanceof THREE.SkinnedMesh)) return mesh.matrixWorld.clone()
  const [joint] = headJointsOf(mesh, headBones)
  return mesh.matrixWorld
    .clone()
    .multiply(mesh.bindMatrixInverse)
    .multiply(mesh.skeleton.bones[joint].matrixWorld)
    .multiply(mesh.skeleton.boneInverses[joint])
    .multiply(mesh.bindMatrix)
}

/** Full strength across the feature's core, easing to nothing at its radius. */
const smoothFalloff = (distance: number, radius: number): number => {
  const closeness = THREE.MathUtils.clamp(
    (radius - distance) / (radius * (1 - FACE_FALLOFF_CORE)),
    0,
    1
  )
  return closeness * closeness * (3 - 2 * closeness)
}

const faceVertexOf = (
  vertex: HeadVertex,
  anchors: FaceAnchor[],
  frame: FaceFrame,
  toGeometry: THREE.Matrix3
): FaceVertex | null => {
  const contributions = anchors.flatMap((anchor) => {
    const radius = (RADIUS_BY_FEATURE.get(anchor.feature) ?? 0) * frame.height
    const distance = vertex.world.distanceTo(anchor.position)
    if (distance >= radius) return []
    return [
      {
        feature: anchor.feature,
        weight: smoothFalloff(distance, radius),
        fromAnchor: vertex.world.clone().sub(anchor.position).applyMatrix3(toGeometry),
        outward: anchor.outward.clone().multiplyScalar(frame.height).applyMatrix3(toGeometry)
      }
    ]
  })
  if (contributions.length === 0) return null
  const rest = new THREE.Vector3().fromBufferAttribute(
    vertex.mesh.geometry.attributes.position,
    vertex.index
  )
  return { index: vertex.index, rest, contributions }
}

const faceRigOfMesh = (
  mesh: THREE.Mesh,
  vertices: HeadVertex[],
  anchors: FaceAnchor[],
  frame: FaceFrame,
  headBones: Set<THREE.Object3D>
): FaceMeshRig | null => {
  if (vertices.length === 0) return null
  const toGeometry = new THREE.Matrix3().setFromMatrix4(geometryToWorld(mesh, headBones).invert())
  const faceVertices = vertices.flatMap((vertex) => {
    const faceVertex = faceVertexOf(vertex, anchors, frame, toGeometry)
    return faceVertex ? [faceVertex] : []
  })
  if (faceVertices.length === 0) return null
  return {
    geometry: mesh.geometry,
    up: WORLD_UP.clone().multiplyScalar(frame.height).applyMatrix3(toGeometry),
    vertices: faceVertices
  }
}

/**
 * Find the face on a loaded model and work out, once, how far each facial feature pulls on each
 * vertex near it. Measured at rest, before any body proportion is changed, so the face's frame
 * is the one the model was authored with.
 *
 * The rig needs a Mixamo head bone: it is what tells the face apart from the rest of the body,
 * through the vertices bound to it. A model without one has no face to edit.
 * @param model The loaded model, already in the scene
 * @param bones The model's bones, resolved to the copies that move it
 * @returns Every mesh a feature reaches, or none when the model has no head to measure
 */
export const measureFace = (model: THREE.Object3D, bones: THREE.Bone[]): FaceMeshRig[] => {
  const head = findBone(bones, FACE_HEAD_BONE)
  if (!head) return []
  model.updateMatrixWorld(true)
  const headBones = new Set(head.getObjectsByProperty('isBone', true))
  const meshes = model
    .getObjectsByProperty('isMesh', true)
    .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
  const vertices = meshes.flatMap((mesh) => headVerticesOf(mesh, headBones))
  if (vertices.length === 0) return []

  const frame = measureFaceFrame(vertices, head, findBone(bones, FACE_CROWN_BONE))
  const anchors = findFaceAnchors(vertices, frame)
  return meshes.flatMap((mesh) => {
    const meshVertices = vertices.filter((vertex) => vertex.mesh === mesh)
    const rig = faceRigOfMesh(mesh, meshVertices, anchors, frame, headBones)
    return rig ? [rig] : []
  })
}

/**
 * The features the measured face actually has a point for, in panel order.
 * @param rig The measured face
 * @returns The names of every feature that reaches at least one vertex
 */
export const featuresInFace = (rig: FaceMeshRig[]): FaceFeatureName[] =>
  FACE_FEATURES.map((feature) => feature.name).filter((name) =>
    rig.some((mesh) =>
      mesh.vertices.some((vertex) =>
        vertex.contributions.some((contribution) => contribution.feature === name)
      )
    )
  )

/**
 * Reshape the face: each reached vertex starts from where it was authored and takes every
 * feature's pull on it, scaled by how close it sits to that feature. The geometry itself moves,
 * under the skin, so a face edit rides along with every bone and ends up in a downloaded model.
 * ponytail: normals are left as authored, fine for the gentle shapes these sliders reach; a
 * feature pushed to an extreme lights as if it had not moved, which recomputing normals over
 * the reached vertices would fix.
 * @param rig The measured face, from `measureFace`
 * @param settings The current setting of every feature
 * @returns Nothing; the geometry is rewritten in place
 */
export const applyFaceFeatures = (rig: FaceMeshRig[], settings: FaceFeatureSettings): void =>
  rig.forEach(({ geometry, up, vertices }) => {
    const position = geometry.attributes.position
    vertices.forEach(({ index, rest, contributions }) => {
      const moved = contributions.reduce((target, { feature, weight, fromAnchor, outward }) => {
        const { size, height, depth } = settings[feature]
        return target
          .addScaledVector(fromAnchor, (size - 1) * weight)
          .addScaledVector(up, height * weight)
          .addScaledVector(outward, depth * weight)
      }, scratchMoved.copy(rest))
      position.setXYZ(index, moved.x, moved.y, moved.z)
    })
    geometry.attributes.position.needsUpdate = true
  })
