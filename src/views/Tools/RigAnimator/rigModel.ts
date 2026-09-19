import * as THREE from 'three'
import { gltfLoader, fbxLoader } from '@webgamekit/threejs'
import {
  rigFindUnskinnedMeshes,
  rigGenerateHumanoidSkeleton,
  rigAutoSkinMesh,
  rigAutoSkinMeshByDistance,
  HUMANOID_BONE_HIERARCHY
} from '@webgamekit/rig'
import { AUTO_SKIN_SURFACE_VERTEX_LIMIT } from './config'

/** Where each canonical humanoid bone belongs in the Bone dropdown, core skeleton first. */
const BONE_DISPLAY_ORDER = new Map(
  HUMANOID_BONE_HIERARCHY.map((definition, index) => [definition.name, index])
)

/**
 * Order a loaded rig's bone names for the Config panel's Bone dropdown, core skeleton (hips,
 * spine, neck, head, arm and leg roots) first in a predictable, posing-relevant order, then
 * everything else (fingers, toes, a custom rig's own extra bones) alphabetically after. A
 * rig's own `skeleton.bones` array order comes straight from however its source file's skin
 * table happened to list them, which for a real export is not necessarily the hierarchy at
 * all: the default model's own bones came back as Neck, Spine2, Spine1, LeftShoulder, Spine,
 * Hips, in that order, burying the very bones someone would reach for to bend a back for a
 * seated or prone pose in an unpredictable scramble.
 * @param boneNames The rig's bone names, in whatever order its skeleton happened to list them
 * @returns The same names, reordered for a human scanning the dropdown top to bottom
 */
export const sortBoneNamesForDisplay = (boneNames: string[]): string[] =>
  [...boneNames].sort((a, b) => {
    const orderA = BONE_DISPLAY_ORDER.get(a)
    const orderB = BONE_DISPLAY_ORDER.get(b)
    if (orderA !== undefined && orderB !== undefined) return orderA - orderB
    if (orderA !== undefined) return -1
    if (orderB !== undefined) return 1
    return a.localeCompare(b)
  })

/**
 * Swap each bone for the topmost bone in its own ancestry that shares its name. A model with more
 * than one skinned mesh can load with one skeleton's bones hung at zero offset beneath another's
 * same-named bones, as Mixamo's Y Bot does, one mesh per skeleton: posing the lower copy turns
 * only the vertices bound to it, not the limb below it, so the mesh comes apart at every joint.
 * The topmost copy carries the real hierarchy, and every copy beneath it follows it.
 * @param bones A skinned mesh's own skeleton bones
 * @returns The bones that actually move the whole model, in the same order
 */
export const resolveHierarchyBones = (bones: THREE.Bone[]): THREE.Bone[] => {
  const topmostNamesake = (bone: THREE.Bone): THREE.Bone =>
    bone.parent instanceof THREE.Bone && bone.parent.name === bone.name
      ? topmostNamesake(bone.parent)
      : bone
  return bones.map(topmostNamesake)
}

const GLTF_EXTENSION_PATTERN = /\.(glb|gltf)$/i

/**
 * Whether a model URL should resolve through the glTF/GLB loader rather than FBX, based on its
 * extension. Exported on its own so the fragment-tagging convention `loadModelFile` relies on
 * can be verified without actually loading geometry.
 * @param url The model URL to check
 */
export const isGltfModelUrl = (url: string): boolean => GLTF_EXTENSION_PATTERN.test(url)

/**
 * Load an uploaded model file, resolving both glTF/GLB and FBX blob URLs. `URL.createObjectURL`
 * gives back an opaque `blob:` URL with no file extension, so which loader to use has nothing
 * to go on unless the caller tags the real filename onto it as a fragment (`${blobUrl}#${name}`)
 * first; the browser strips that fragment before actually dereferencing the blob, so the fetch
 * itself is unaffected, but the extension test above still sees it.
 * @param url The blob URL a file input produced, ideally with the original filename as a fragment
 * @returns The loaded model, not yet added to any scene
 */
export const loadModelFile = async (url: string): Promise<THREE.Object3D> =>
  isGltfModelUrl(url) ? (await gltfLoader.loadAsync(url)).scene : await fbxLoader.loadAsync(url)

/**
 * Dispose every geometry under a model before it is discarded.
 * @param model The model about to be replaced or removed
 */
export const disposeModel = (model: THREE.Object3D): void => {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
  })
}

/** Swap each triangle's last two corners, turning its front face to the other side. */
const flipTriangleWinding = (geometry: THREE.BufferGeometry): void => {
  const index = geometry.index
  if (!index) return
  Array.from({ length: Math.floor(index.count / 3) }, (_, face) => face * 3).forEach((corner) => {
    const second = index.getX(corner + 1)
    index.setX(corner + 1, index.getX(corner + 2))
    index.setX(corner + 2, second)
  })
}

/**
 * A copy of a mesh's geometry with every transform between it and the model baked in, so its
 * vertices and the generated bones share one space. A mirrored transform turns the triangles
 * inside out once it is baked, so their winding is turned back.
 * ponytail: only indexed geometry is turned back; a mirrored flat (unindexed) mesh stays inside
 * out, which needs its position triples swapped instead if one ever turns up.
 */
const geometryInModelSpace = (mesh: THREE.Mesh, model: THREE.Object3D): THREE.BufferGeometry => {
  const meshToModel = model.matrixWorld.clone().invert().multiply(mesh.matrixWorld)
  const geometry = mesh.geometry.clone().applyMatrix4(meshToModel)
  if (meshToModel.determinant() < 0) flipTriangleWinding(geometry)
  geometry.computeBoundingBox()
  return geometry
}

const positionsOf = (geometry: THREE.BufferGeometry): number[] => {
  const position = geometry.attributes.position
  return Array.from({ length: position.count }, (_, index) => [
    position.getX(index),
    position.getY(index),
    position.getZ(index)
  ]).flat()
}

const triangleCornersOf = (geometry: THREE.BufferGeometry): number[] =>
  geometry.index
    ? [...geometry.index.array]
    : Array.from({ length: geometry.attributes.position.count }, (_, index) => index)

/**
 * Skin every geometry as parts of one surface rather than each on its own. Skinned one at a time,
 * a figure built from separate parts (a sphere for a head, a box for a torso) seeds every bone
 * inside every part, so the head sphere is carved up between the neck, the shoulders and the
 * spine instead of following the head. As one surface each bone seeds once, where it truly
 * sits nearest, and a part no seed reaches falls back to the bones nearest it in a straight line.
 * Past a vertex budget the surface search would hold the page for minutes, so a dense model is
 * bound by straight-line distance alone.
 */
const skinAsOneSurface = (geometries: THREE.BufferGeometry[], bones: THREE.Bone[]): void => {
  const vertexCounts = geometries.map((geometry) => geometry.attributes.position.count)
  const offsets = vertexCounts.map((_, index) =>
    vertexCounts.slice(0, index).reduce((total, count) => total + count, 0)
  )
  const surface = new THREE.BufferGeometry()
  surface.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(geometries.flatMap(positionsOf), 3)
  )
  surface.setIndex(
    geometries.flatMap((geometry, index) =>
      triangleCornersOf(geometry).map((corner) => corner + offsets[index])
    )
  )
  const skinSurface =
    surface.attributes.position.count > AUTO_SKIN_SURFACE_VERTEX_LIMIT
      ? rigAutoSkinMeshByDistance
      : rigAutoSkinMesh
  skinSurface(surface, bones)

  const { skinIndex, skinWeight } = surface.attributes
  geometries.forEach((geometry, index) => {
    const range: [number, number] = [offsets[index] * 4, (offsets[index] + vertexCounts[index]) * 4]
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(skinIndex.array.slice(...range), 4)
    )
    geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(skinWeight.array.slice(...range), 4)
    )
  })
  surface.dispose()
}

/**
 * Generate a humanoid skeleton fit to the model and auto-skin every unrigged mesh to it,
 * replacing each with a bound SkinnedMesh hung straight off the model.
 *
 * Everything is worked out in the model's own space. A mesh nested under an offset or scaled
 * node (a leg under its hip group, a whole figure scaled up a hundredfold) otherwise has its
 * vertices measured in one space and the bones placed in another, and every vertex binds to
 * whichever bone happens to sit nearest in the wrong one.
 * @param model The model to rig, mutated in place
 * @returns The newly skinned meshes, or null when the model had nothing left to rig
 */
export const generateAutoRig = (model: THREE.Object3D): THREE.SkinnedMesh[] | null => {
  const unskinnedMeshes = rigFindUnskinnedMeshes(model)
  if (unskinnedMeshes.length === 0) return null

  model.updateMatrixWorld(true)
  const geometries = unskinnedMeshes.map((mesh) => geometryInModelSpace(mesh, model))
  const box = geometries.reduce(
    (union, geometry) => (geometry.boundingBox ? union.union(geometry.boundingBox) : union),
    new THREE.Box3()
  )
  // Skinned before the root joins the model, while each bone's world position is still its
  // position in model space, the space the geometry was just baked into.
  const { root, bones, skeleton } = rigGenerateHumanoidSkeleton(box)
  skinAsOneSurface(geometries, bones)
  model.add(root)

  const replacements = unskinnedMeshes.map((mesh, index) => {
    const replacement = Object.assign(new THREE.SkinnedMesh(geometries[index], mesh.material), {
      name: mesh.name,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow
    })
    model.add(replacement)
    mesh.removeFromParent()
    return replacement
  })
  model.updateMatrixWorld(true)
  replacements.forEach((replacement) => replacement.bind(skeleton))
  new Set(unskinnedMeshes.map((mesh) => mesh.geometry)).forEach((geometry) => geometry.dispose())
  return replacements
}
