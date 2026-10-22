import * as THREE from 'three'
import { loadGLTF } from '@webgamekit/threejs'
import {
  MARKET_AVATARS_MODEL,
  CITY_VIEW_DIRECTION,
  CITY_CAMERA_DISTANCE,
  CITY_CAMERA_NEAR,
  CITY_MAX_PIXEL_RATIO,
  AVATAR_FRAME_PADDING,
  AVATAR_SWING,
  AVATAR_SWING_SPEED,
  AVATAR_SWING_STAGGER
} from './config'
import { createCityLights } from './cityStage'
import type { AvatarStage, SectorAvatar, ViewportRect } from './types'

const AVATAR_PREFIX = 'avatar-'

// Each avatar gets its own camera, seen from the same direction as the city and framing the
// sphere around the model, so the model can turn without leaving its circle.
const frameAvatar = (object: THREE.Object3D): SectorAvatar => {
  const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere())
  const extent = sphere.radius * AVATAR_FRAME_PADDING
  const camera = new THREE.OrthographicCamera(
    -extent,
    extent,
    extent,
    -extent,
    CITY_CAMERA_NEAR,
    CITY_CAMERA_DISTANCE * 2
  )
  camera.position
    .set(...CITY_VIEW_DIRECTION)
    .normalize()
    .multiplyScalar(CITY_CAMERA_DISTANCE)
    .add(sphere.center)
  camera.lookAt(sphere.center)
  return { object, camera, baseYaw: object.rotation.y }
}

/**
 * Loads the six sector avatars into one scene, lit like the city.
 * @param canvas The canvas every avatar is drawn into.
 * @param keys The avatar of each sector, in page order.
 * @returns The renderer, the scene and each sector's avatar, or null where the model lacks it.
 */
export const createAvatarStage = async (
  canvas: HTMLCanvasElement,
  keys: string[]
): Promise<AvatarStage> => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CITY_MAX_PIXEL_RATIO))
  renderer.autoClear = false
  const scene = new THREE.Scene()
  const { model } = await loadGLTF(MARKET_AVATARS_MODEL)
  scene.add(model)
  model.updateMatrixWorld(true)
  createCityLights(scene, new THREE.Box3().setFromObject(model))
  const avatars = keys.map((key) => {
    const object = model.getObjectByName(`${AVATAR_PREFIX}${key}`)
    return object ? frameAvatar(object) : null
  })
  return { renderer, scene, avatars }
}

/**
 * Converts an element's box on screen into the viewport that draws over it in a canvas.
 * @param element The element's box, in viewport pixels.
 * @param canvas The canvas's box, in viewport pixels.
 * @returns The rectangle measured from the canvas's bottom-left corner.
 */
export const toViewportRect = (
  element: DOMRectReadOnly,
  canvas: DOMRectReadOnly
): ViewportRect => ({
  x: element.left - canvas.left,
  y: canvas.bottom - element.bottom,
  width: element.width,
  height: element.height
})

/**
 * How far an avatar has turned from its resting pose at a moment.
 * @param seconds Time since the avatars started moving.
 * @param index The avatar's place in the row.
 * @returns The turn in radians.
 */
export const getAvatarSwing = (seconds: number, index: number): number =>
  Math.sin((seconds * AVATAR_SWING_SPEED + index * AVATAR_SWING_STAGGER) * Math.PI * 2) *
  AVATAR_SWING

/**
 * Draws every avatar into the part of the canvas that covers its circle.
 * @param stage The avatar stage.
 * @param viewports Where each avatar's circle is in the canvas, in page order.
 * @param seconds Time since the avatars started moving.
 */
export const renderAvatars = (
  stage: AvatarStage,
  viewports: ViewportRect[],
  seconds: number
): void => {
  const { renderer, scene } = stage
  renderer.setScissorTest(false)
  renderer.clear()
  renderer.setScissorTest(true)
  stage.avatars.forEach((avatar, index) => {
    const viewport = viewports[index]
    if (!avatar || !viewport) return
    avatar.object.rotation.y = avatar.baseYaw + getAvatarSwing(seconds, index)
    renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
    renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height)
    renderer.render(scene, avatar.camera)
  })
}
