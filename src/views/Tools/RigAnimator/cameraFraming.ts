import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CAMERA_FRAME_DISTANCE_MULTIPLIER } from './config'

/**
 * Reposition the camera and orbit target so a freshly loaded model, whatever its own scale,
 * fills the view instead of sitting either microscopic or too close to see.
 * @param camera The active camera to move
 * @param orbit The scene's orbit controls, if any
 * @param model The model to frame
 * @param yaw Rotate the camera this far, in radians, around the model before framing it: 0
 *   (the default) is square-on, matching `estimateCameraYaw`'s own convention for a detected
 *   photo's viewing angle.
 */
export const frameCameraOnModel = (
  camera: THREE.Camera,
  orbit: OrbitControls | null,
  model: THREE.Object3D,
  yaw = 0
): void => {
  const box = new THREE.Box3().setFromObject(model)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  if (sphere.radius <= 0) return

  const distance = sphere.radius * CAMERA_FRAME_DISTANCE_MULTIPLIER
  const offset = new THREE.Vector3(0, 0, distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  camera.position.copy(sphere.center).add(offset)
  camera.lookAt(sphere.center)

  if (orbit) {
    orbit.target.copy(sphere.center)
    orbit.update()
  }
}
