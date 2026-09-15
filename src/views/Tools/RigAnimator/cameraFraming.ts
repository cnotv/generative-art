import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CAMERA_FRAME_DISTANCE_MULTIPLIER } from './config'

/**
 * Shift the camera's view offset so the model sits centred in whatever part of the canvas the
 * docked camera preview leaves visible, or clear that shift once nothing covers the canvas. The
 * canvas itself never resizes for this: `setViewOffset` renders one slice of a frame twice the
 * canvas's width, so the window-based resize handling elsewhere never needs to know about the
 * panel at all.
 * @param camera The active camera
 * @param width The canvas's width, in pixels
 * @param height The canvas's height, in pixels
 * @param coveredFraction How much of the canvas's width the preview covers, 0 for none
 */
export const centerCameraOnVisibleCanvas = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  width: number,
  height: number,
  coveredFraction: number
): void => {
  if (coveredFraction > 0) {
    const visibleWidth = width * (1 - coveredFraction)
    camera.setViewOffset(width * 2, height, width - visibleWidth / 2, 0, width, height)
    return
  }
  // setViewOffset overwrote a perspective camera's aspect with the doubled frame's own, and
  // clearViewOffset never puts it back: left alone, the scene renders squashed to half width.
  if (camera instanceof THREE.PerspectiveCamera) camera.aspect = width / height
  camera.clearViewOffset()
}

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
