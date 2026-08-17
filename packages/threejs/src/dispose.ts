import * as THREE from 'three'

/**
 * Geometries and textures owned by the asset cache. Every model handed out shares these with
 * the cached source, so disposing one instance would free memory the cache is still handing
 * to everyone else — and the next scene to load that url would render nothing.
 *
 * Only the cache may free them, by unmarking first and disposing after.
 */
const sharedResources = new WeakSet<object>()

/**
 * Mark everything in a tree as owned by the asset cache, exempting it from disposal.
 * @param object The cached source
 */
export const disposeMarkShared = (object: THREE.Object3D): void => {
  forEachResource(object, (resource) => sharedResources.add(resource))
}

/**
 * Give up cache ownership of a tree so it can be disposed normally.
 * @param object The cached source being dropped
 */
export const disposeUnmarkShared = (object: THREE.Object3D): void => {
  forEachResource(object, (resource) => sharedResources.delete(resource))
}

const materialTextures = (material: THREE.Material): THREE.Texture[] => {
  const properties = material as THREE.Material & Record<string, unknown>
  return [
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
    .map((key) => properties[key])
    .filter((texture): texture is THREE.Texture => texture instanceof THREE.Texture)
}

const forEachResource = (object: THREE.Object3D, visit: (resource: object) => void): void => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    if (mesh.geometry) visit(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.filter(Boolean).forEach((material) => materialTextures(material).forEach(visit))
  })
}

/**
 * Dispose a single material, including all map textures it holds.
 * @param material The material to dispose
 */
const disposeMaterial = (material: THREE.Material): void => {
  materialTextures(material)
    .filter((texture) => !sharedResources.has(texture))
    .forEach((texture) => texture.dispose())
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

    if (mesh.geometry && !sharedResources.has(mesh.geometry)) mesh.geometry.dispose()

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
