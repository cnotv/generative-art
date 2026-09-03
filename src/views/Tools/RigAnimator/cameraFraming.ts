import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CAMERA_FRAME_DISTANCE_MULTIPLIER } from './config'

/**
 * Reposition the camera and orbit target so a freshly loaded model, whatever its own scale,
 * fills the view instead of sitting either microscopic or too close to see.
 * @param camera The active camera to move
 * @param orbit The scene's orbit controls, if any
 * @param model The model to frame
 */
export const frameCameraOnModel = (
  camera: THREE.Camera,
  orbit: OrbitControls | null,
  model: THREE.Object3D
): void => {
  const box = new THREE.Box3().setFromObject(model)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  if (sphere.radius <= 0) return

  const distance = sphere.radius * CAMERA_FRAME_DISTANCE_MULTIPLIER
  camera.position.set(sphere.center.x, sphere.center.y, sphere.center.z + distance)
  camera.lookAt(sphere.center)

  if (orbit) {
    orbit.target.copy(sphere.center)
    orbit.update()
  }
}
