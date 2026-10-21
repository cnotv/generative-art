import * as THREE from 'three'
import { loadGLTF } from '@webgamekit/threejs'
import {
  SKILLS_CITY_MODEL,
  CITY_VIEW_DIRECTION,
  CITY_CAMERA_DISTANCE,
  CITY_CAMERA_NEAR,
  CITY_FRAME_PADDING,
  CITY_SKY_COLOR,
  CITY_GROUND_COLOR,
  CITY_AMBIENT_INTENSITY,
  CITY_KEY_COLOR,
  CITY_KEY_INTENSITY,
  CITY_KEY_POSITION,
  CITY_SHADOW_EXTENT,
  CITY_SHADOW_MAP_SIZE,
  CITY_MAX_PIXEL_RATIO,
  DISTRICT_LIFT,
  DISTRICT_LIFT_EASE,
  DISTRICT_LIFT_SETTLED
} from './config'
import type { SkillsCityStage } from './types'

const DISTRICT_PREFIX = 'district-'

const isDistrict = (object: THREE.Object3D | null): boolean =>
  object?.name.startsWith(DISTRICT_PREFIX) ?? false

const createCityLights = (scene: THREE.Scene, bounds: THREE.Box3): void => {
  scene.add(new THREE.HemisphereLight(CITY_SKY_COLOR, CITY_GROUND_COLOR, CITY_AMBIENT_INTENSITY))
  const key = new THREE.DirectionalLight(CITY_KEY_COLOR, CITY_KEY_INTENSITY)
  key.position.set(...CITY_KEY_POSITION)
  key.target.position.copy(bounds.getCenter(new THREE.Vector3()))
  key.castShadow = true
  key.shadow.mapSize.setScalar(CITY_SHADOW_MAP_SIZE)
  Object.assign(key.shadow.camera, {
    left: -CITY_SHADOW_EXTENT,
    right: CITY_SHADOW_EXTENT,
    top: CITY_SHADOW_EXTENT,
    bottom: -CITY_SHADOW_EXTENT
  })
  scene.add(key, key.target)
}

/**
 * Loads the skills city model into a scene of its own, lit like the hero room and seen from an
 * isometric orthographic camera.
 * @param canvas The canvas the city renders into.
 * @returns The renderer, scene, camera, the city's outline points and its district objects.
 */
export const createCityStage = async (canvas: HTMLCanvasElement): Promise<SkillsCityStage> => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CITY_MAX_PIXEL_RATIO))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const { model } = await loadGLTF(SKILLS_CITY_MODEL)
  model.traverse((child) => {
    child.castShadow = true
    child.receiveShadow = true
  })
  scene.add(model)
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  createCityLights(scene, bounds)

  // A district with several materials loads as a group whose meshes are named after it
  // (district-ci_1, ...), so only the outermost object with the prefix is the district.
  const districts: THREE.Object3D[] = []
  model.traverse((child) => {
    if (isDistrict(child) && !isDistrict(child.parent)) districts.push(child)
  })
  districts.forEach((district) => (district.userData.restY = district.position.y))
  const outline = collectOutline(model)

  const camera = new THREE.OrthographicCamera(
    -1,
    1,
    1,
    -1,
    CITY_CAMERA_NEAR,
    CITY_CAMERA_DISTANCE * 2
  )
  const center = bounds.getCenter(new THREE.Vector3())
  camera.position
    .set(...CITY_VIEW_DIRECTION)
    .normalize()
    .multiplyScalar(CITY_CAMERA_DISTANCE)
    .add(center)
  camera.lookAt(center)

  return { renderer, scene, camera, outline, districts }
}

// Every vertex in world space: framing the box corners instead leaves the empty air above the
// back of the city in the frame and shrinks the city to about half the canvas.
const collectOutline = (model: THREE.Object3D): THREE.Vector3[] => {
  const points: THREE.Vector3[] = []
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    Array.from({ length: position.count }).forEach((_, index) =>
      points.push(
        new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
      )
    )
  })
  return points
}

const viewPoint = new THREE.Vector3()

/**
 * Frames the whole city in the camera for a given canvas shape, keeping it centred.
 * @param camera The city's orthographic camera.
 * @param outline The city's vertices in world space.
 * @param aspect Canvas width over height.
 */
export const fitCityCamera = (
  camera: THREE.OrthographicCamera,
  outline: THREE.Vector3[],
  aspect: number
): void => {
  camera.updateMatrixWorld(true)
  const projected = outline.map((point) => {
    viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse)
    return [viewPoint.x, viewPoint.y]
  })
  const xs = projected.map(([x]) => x)
  const ys = projected.map(([, y]) => y)
  const width = (Math.max(...xs) - Math.min(...xs)) * CITY_FRAME_PADDING
  const height = (Math.max(...ys) - Math.min(...ys)) * CITY_FRAME_PADDING
  const [frameWidth, frameHeight] =
    width / height > aspect ? [width, width / aspect] : [height * aspect, height]
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2
  Object.assign(camera, {
    left: centerX - frameWidth / 2,
    right: centerX + frameWidth / 2,
    top: centerY + frameHeight / 2,
    bottom: centerY - frameHeight / 2
  })
  camera.updateProjectionMatrix()
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const findDistrictAncestor = (object: THREE.Object3D | null): THREE.Object3D | null => {
  if (!object) return null
  return isDistrict(object) && !isDistrict(object.parent)
    ? object
    : findDistrictAncestor(object.parent)
}

/**
 * Finds the district under a pointer position on the city canvas.
 * @param stage The city stage.
 * @param clientX Pointer x in viewport pixels.
 * @param clientY Pointer y in viewport pixels.
 * @returns The district's name, or null over empty ground.
 */
export const pickDistrict = (
  stage: SkillsCityStage,
  clientX: number,
  clientY: number
): string | null => {
  const bounds = stage.renderer.domElement.getBoundingClientRect()
  pointer.set(
    ((clientX - bounds.left) / bounds.width) * 2 - 1,
    -((clientY - bounds.top) / bounds.height) * 2 + 1
  )
  raycaster.setFromCamera(pointer, stage.camera)
  const [hit] = raycaster.intersectObjects(stage.districts, true)
  return findDistrictAncestor(hit?.object ?? null)?.name ?? null
}

/**
 * Eases every district towards its resting height, lifting the hovered one.
 * @param stage The city stage.
 * @param hovered The hovered district's name, or null.
 * @returns Whether any district is still moving.
 */
export const updateDistrictLift = (stage: SkillsCityStage, hovered: string | null): boolean =>
  stage.districts
    .map((district) => {
      const target = district.userData.restY + (district.name === hovered ? DISTRICT_LIFT : 0)
      const gap = target - district.position.y
      district.position.y =
        Math.abs(gap) < DISTRICT_LIFT_SETTLED
          ? target
          : district.position.y + gap * DISTRICT_LIFT_EASE
      return district.position.y !== target
    })
    .some(Boolean)
