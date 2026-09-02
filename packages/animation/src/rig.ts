import * as THREE from 'three'

/**
 * Find the first skinned mesh under a model, the mesh whose skeleton a rig editor can pose.
 * @param root The loaded model to search
 * @returns The first SkinnedMesh found, or null when the model was never rigged
 */
export const rigFindSkinnedMesh = (root: THREE.Object3D): THREE.SkinnedMesh | null => {
  let found: THREE.SkinnedMesh | null = null
  root.traverse((child) => {
    if (!found && (child as THREE.SkinnedMesh).isSkinnedMesh) found = child as THREE.SkinnedMesh
  })
  return found
}

/**
 * Find every plain mesh under a model that carries no skeleton, the meshes an auto-rig pass
 * would need to skin.
 * @param root The loaded model to search
 * @returns Every un-skinned mesh found, in traversal order
 */
export const rigFindUnskinnedMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) {
      meshes.push(child as THREE.Mesh)
    }
  })
  return meshes
}
