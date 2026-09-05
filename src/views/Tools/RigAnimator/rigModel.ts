import * as THREE from 'three'
import { gltfLoader, fbxLoader } from '@webgamekit/threejs'
import {
  rigFindUnskinnedMeshes,
  rigGenerateHumanoidSkeleton,
  rigAutoSkinMesh,
  HUMANOID_BONE_HIERARCHY
} from '@webgamekit/rig'

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

/**
 * Generate a humanoid skeleton fit to the model and auto-skin every unrigged mesh to it,
 * replacing each with a bound SkinnedMesh.
 * @param model The model to rig, mutated in place
 * @returns The newly skinned meshes, or null when the model had nothing left to rig
 */
export const generateAutoRig = (model: THREE.Object3D): THREE.SkinnedMesh[] | null => {
  const unskinnedMeshes = rigFindUnskinnedMeshes(model)
  if (unskinnedMeshes.length === 0) return null

  const box = new THREE.Box3().setFromObject(model)
  const { root, bones, skeleton } = rigGenerateHumanoidSkeleton(box)
  model.add(root)

  return unskinnedMeshes.map((mesh) => {
    rigAutoSkinMesh(mesh.geometry, bones)
    const replacement = new THREE.SkinnedMesh(mesh.geometry, mesh.material)
    replacement.position.copy(mesh.position)
    replacement.rotation.copy(mesh.rotation)
    replacement.scale.copy(mesh.scale)
    replacement.bind(skeleton)
    mesh.parent?.add(replacement)
    mesh.parent?.remove(mesh)
    return replacement
  })
}
