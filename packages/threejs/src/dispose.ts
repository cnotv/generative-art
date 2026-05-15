import * as THREE from 'three'

/**
 * Dispose a single material, including all map textures it holds.
 * @param material The material to dispose
 */
const disposeMaterial = (material: THREE.Material): void => {
  const mat = material as THREE.MeshStandardMaterial & Record<string, unknown>
  const textureKeys = [
    'map',
    'lightMap',
    'bumpMap',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'envMap',
    'displacementMap',
    'specularMap'
  ]
  textureKeys.forEach((key) => {
    const texture = mat[key]
    if (texture instanceof THREE.Texture) texture.dispose()
  })
  material.dispose()
}

/**
 * Recursively dispose all geometries and materials (including their textures)
 * in an Object3D tree. Safe to call on groups, scenes, or individual meshes.
 *
 * Call this before removing an object from the scene on unmount to prevent
 * GPU memory leaks.
 * @param object The root object to dispose
 */
export const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return

    mesh.geometry?.dispose()

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial)
    } else if (mesh.material) {
      disposeMaterial(mesh.material)
    }
  })
}

/**
 * Dispose a WebGLRenderer and all tracked objects in the associated scene.
 * Convenience wrapper combining disposeObject + renderer.dispose().
 * @param renderer The WebGLRenderer to dispose
 * @param scene Optional scene whose children to recursively dispose first
 */
export const disposeScene = (
  renderer: THREE.WebGLRenderer,
  scene?: THREE.Scene | THREE.Object3D
): void => {
  if (scene) disposeObject(scene)
  renderer.dispose()
}
