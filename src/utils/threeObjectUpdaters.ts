import * as THREE from 'three'

/**
 * Shows a hidden object, or hides a shown one.
 * @param object The object to toggle.
 */
export const toggleObjectVisibility = (object: THREE.Object3D): void => {
  object.visible = !object.visible
}

/**
 * Sets a camera's field of view and refreshes its projection.
 * @param camera The camera.
 * @param fov The field of view, in degrees.
 */
export const updateCameraFov = (camera: THREE.PerspectiveCamera, fov: number): void => {
  camera.fov = fov
  camera.updateProjectionMatrix()
}

/**
 * Swaps a mesh's geometry, disposing the old one so it does not leak.
 * @param mesh The mesh to update.
 * @param geometry The new geometry.
 */
export const replaceGeometry = (
  mesh: { geometry: THREE.BufferGeometry },
  geometry: THREE.BufferGeometry
): void => {
  mesh.geometry.dispose()
  mesh.geometry = geometry
}

/**
 * Turns orbit controls on or off.
 * @param orbit The orbit controls.
 * @param enabled Whether they respond to input.
 */
export const setOrbitEnabled = (orbit: { enabled: boolean }, enabled: boolean): void => {
  orbit.enabled = enabled
}

/**
 * Sets a scene's environment map.
 * @param scene The scene.
 * @param texture The new environment map, or null to remove it.
 * @returns The previous environment map.
 */
export const setSceneEnvironment = (
  scene: THREE.Scene,
  texture: THREE.Texture | null
): THREE.Texture | null => {
  const previous = scene.environment
  scene.environment = texture
  return previous
}
