import * as THREE from 'three'
import { loadGLTF } from '@webgamekit/threejs'
import {
  SKILLS_CITY_MODEL,
  CITY_VIEW_DIRECTION,
  CITY_CAMERA_DISTANCE,
  CITY_CAMERA_NEAR,
  CITY_FRAME_PADDING,
  CITY_LABEL_HEADROOM,
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
import type { SkillsCityStage, DistrictAnchor, CityMover, MotionKind } from './types'

const DISTRICT_PREFIX = 'district-'
const MOTION_KINDS: MotionKind[] = [
  'spin',
  'swing',
  'bob',
  'slide',
  'puff',
  'grow',
  'pulse',
  'stretch',
  'arc'
]
/** How far below its spout a water drop lands, as a share of how high it rises. */
const ARC_FALL = 1.6
const AXES = ['x', 'y', 'z'] as const
const PUFF_SHRINK = 0.6
const MIN_SCALE = 0.001

const isMotionKind = (value: unknown): value is MotionKind =>
  MOTION_KINDS.some((kind) => kind === value)

const isAxis = (value: unknown): value is CityMover['axis'] => AXES.some((axis) => axis === value)

const readNumber = (value: unknown): number => (typeof value === 'number' ? value : 0)

// A fading part gets its own transparent copy of each material, so fading it leaves every
// other object that shares the material untouched.
const takeFadeMaterials = (object: THREE.Object3D): THREE.Material[] => {
  const materials: THREE.Material[] = []
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) return
    const material = mesh.material.clone()
    material.transparent = true
    mesh.material = material
    materials.push(material)
  })
  return materials
}

// The motion tags come from the model file's extras, so each one is checked rather than trusted.
const collectMovers = (model: THREE.Object3D): CityMover[] => {
  const movers: CityMover[] = []
  model.traverse((object) => {
    const { anim, axis, speed, amount, phase, lift } = object.userData
    if (!isMotionKind(anim)) return
    movers.push({
      object,
      kind: anim,
      axis: isAxis(axis) ? axis : 'y',
      speed: readNumber(speed),
      amount: readNumber(amount),
      phase: readNumber(phase),
      lift: readNumber(lift),
      basePosition: object.position.clone(),
      baseRotation: object.rotation.clone(),
      baseScale: object.scale.clone(),
      fadeMaterials: anim === 'puff' ? takeFadeMaterials(object) : []
    })
  })
  return movers
}

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
  districts.forEach((district) => {
    district.userData.restY = district.position.y
    const bounds = new THREE.Box3().setFromObject(district)
    // The centre of the district's ground, not its highest point: a tall tower would otherwise
    // lift its label over the neighbouring districts.
    district.userData.anchor = bounds.getCenter(new THREE.Vector3()).setY(bounds.min.y)
  })
  const outline = collectOutline(model)
  const movers = collectMovers(model)

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

  return { renderer, scene, camera, outline, districts, movers }
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
  // Room above the city for the labels that sit over the districts at the back.
  const headroom = (Math.max(...ys) - Math.min(...ys)) * CITY_LABEL_HEADROOM
  const width = (Math.max(...xs) - Math.min(...xs)) * CITY_FRAME_PADDING
  const height = (Math.max(...ys) - Math.min(...ys)) * CITY_FRAME_PADDING + headroom
  const [frameWidth, frameHeight] =
    width / height > aspect ? [width, width / aspect] : [height * aspect, height]
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2 + headroom / 2
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

const anchorPoint = new THREE.Vector3()

/**
 * Where each district's top sits on the canvas, for pinning its label to it.
 * @param stage The city stage.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @returns Each district's name and its top centre in canvas pixels.
 */
export const projectDistrictAnchors = (
  stage: SkillsCityStage,
  width: number,
  height: number
): DistrictAnchor[] =>
  stage.districts.map((district) => {
    anchorPoint.copy(district.userData.anchor).project(stage.camera)
    return {
      district: district.name,
      x: ((anchorPoint.x + 1) / 2) * width,
      y: ((1 - anchorPoint.y) / 2) * height
    }
  })

const fraction = (value: number): number => value - Math.floor(value)

/**
 * The value a motion takes at a moment: an angle, an offset, a 0 to 1 progress or a scale.
 * @param mover The moving part and its motion.
 * @param seconds Time since the city started moving.
 * @returns The motion's value at that time.
 */
export const getMotionValue = (
  mover: Pick<CityMover, 'kind' | 'speed' | 'amount' | 'phase'>,
  seconds: number
): number => {
  const { kind, speed, amount, phase } = mover
  const wave = Math.sin(seconds * speed + phase * Math.PI * 2)
  if (kind === 'spin') return seconds * speed
  if (kind === 'swing' || kind === 'bob') return wave * amount
  if (kind === 'slide') return fraction(seconds * speed + phase) * amount
  if (kind === 'puff' || kind === 'arc') return fraction(seconds * speed + phase)
  if (kind === 'grow') return Math.max(MIN_SCALE, fraction(seconds * speed + phase))
  return 1 + wave * amount
}

const applyMotion = (mover: CityMover, seconds: number): void => {
  const { object, kind, axis, amount, basePosition, baseRotation, baseScale } = mover
  const value = getMotionValue(mover, seconds)
  if (kind === 'spin' || kind === 'swing') object.rotation[axis] = baseRotation[axis] + value
  if (kind === 'bob' || kind === 'slide') object.position[axis] = basePosition[axis] + value
  if (kind === 'grow') object.scale[axis] = baseScale[axis] * value
  if (kind === 'pulse') object.scale.copy(baseScale).multiplyScalar(value)
  if (kind === 'stretch') object.scale[axis] = baseScale[axis] * value
  if (kind === 'arc') {
    object.position[axis] = basePosition[axis] + value * amount
    object.position.y = basePosition.y + (4 * value * (1 - value) - ARC_FALL * value) * mover.lift
  }
  if (kind === 'puff') {
    object.position.y = basePosition.y + value * amount
    object.scale.copy(baseScale).multiplyScalar(1 - value * PUFF_SHRINK)
    mover.fadeMaterials.forEach((material) => (material.opacity = 1 - value))
  }
}

/**
 * Moves every animated part of the city to where it is at a given time.
 * @param stage The city stage.
 * @param seconds Time since the city started moving.
 */
export const updateCityMotion = (stage: SkillsCityStage, seconds: number): void => {
  stage.movers.forEach((mover) => applyMotion(mover, seconds))
}
