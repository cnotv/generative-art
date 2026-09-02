import * as THREE from 'three'
import { gltfLoader, fbxLoader } from '@webgamekit/threejs'
import {
  rigFindUnskinnedMeshes,
  rigGenerateHumanoidSkeleton,
  rigAutoSkinMesh
} from '@webgamekit/animation'

const GLTF_EXTENSION_PATTERN = /\.(glb|gltf)$/i

/**
 * Load an uploaded model file, resolving both glTF/GLB and FBX blob URLs.
 * @param url The blob URL a file input produced
 * @returns The loaded model, not yet added to any scene
 */
export const loadModelFile = async (url: string): Promise<THREE.Object3D> =>
  GLTF_EXTENSION_PATTERN.test(url)
    ? (await gltfLoader.loadAsync(url)).scene
    : await fbxLoader.loadAsync(url)

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
