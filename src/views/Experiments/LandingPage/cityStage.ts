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
import type {
  SkillsCityStage,
  CityMover,
  MotionKind,
  CanvasRect,
  RouteSegment,
  RouteSpot
} from './types'

const DISTRICT_PREFIX = 'district-'
const SCREEN_NAME = 'title-screen'
const MOTION_KINDS: MotionKind[] = [
  'spin',
  'swing',
  'bob',
  'slide',
  'puff',
  'grow',
  'pulse',
  'stretch',
  'arc',
  'route'
]
/** Shares of a route's cycle: sailing out, then waiting at the far end before sailing back. */
const ROUTE_LEG = 0.4
const ROUTE_RETURN = 0.5
/** How far below its spout a water drop lands, as a share of how high it rises. */
const ARC_FALL = 1.6
const AXES = ['x', 'y', 'z'] as const
const PUFF_SHRINK = 0.6
const MIN_SCALE = 0.001

const isMotionKind = (value: unknown): value is MotionKind =>
  MOTION_KINDS.some((kind) => kind === value)

const isAxis = (value: unknown): value is CityMover['axis'] => AXES.some((axis) => axis === value)

const readNumber = (value: unknown): number => (typeof value === 'number' ? value : 0)

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

/**
 * Turns a flat list of ground-plane coordinates into the legs of a course.
 * @param coordinates x and y of each point in turn, as Blender stores them.
 * @returns The legs, each with how far along the course it starts.
 */
export const toRouteSegments = (coordinates: number[]): RouteSegment[] => {
  const points = Array.from({ length: Math.floor(coordinates.length / 2) }, (_, index) => [
    coordinates[index * 2],
    coordinates[index * 2 + 1]
  ])
  const legs = points.slice(1).map(([endX, endY], index) => {
    const [startX, startY] = points[index]
    return { startX, startY, endX, endY, length: Math.hypot(endX - startX, endY - startY) }
  })
  return legs.map((leg, index) => ({
    ...leg,
    offset: legs.slice(0, index).reduce((total, { length }) => total + length, 0)
  }))
}

/**
 * Where a part is along its course and which way the leg it is on points.
 * @param segments The course's legs.
 * @param progress How far along the course, from 0 at its start to 1 at its end.
 * @returns The point and heading in the ground plane.
 */
export const getRouteSpot = (segments: RouteSegment[], progress: number): RouteSpot => {
  const last = segments[segments.length - 1]
  const distance = progress * (last.offset + last.length)
  const leg = segments.findLast(({ offset }) => offset <= distance) ?? segments[0]
  const along = leg.length > 0 ? Math.min(1, (distance - leg.offset) / leg.length) : 0
  return {
    x: leg.startX + (leg.endX - leg.startX) * along,
    y: leg.startY + (leg.endY - leg.startY) * along,
    heading: Math.atan2(leg.endY - leg.startY, leg.endX - leg.startX)
  }
}

const easeInOut = (share: number): number => share * share * (3 - 2 * share)

/**
 * How far along its course a part is at a point in its cycle: it sails out, waits at the far end,
 * sails back and waits at home.
 * @param cycle The share of the cycle gone, from 0 to 1.
 * @returns The progress along the course, from 0 to 1.
 */
export const getRouteProgress = (cycle: number): number => {
  if (cycle < ROUTE_LEG) return easeInOut(cycle / ROUTE_LEG)
  if (cycle < ROUTE_RETURN) return 1
  if (cycle < ROUTE_RETURN + ROUTE_LEG) return 1 - easeInOut((cycle - ROUTE_RETURN) / ROUTE_LEG)
  return 0
}

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
    const { anim, axis, speed, amount, phase, lift, route } = object.userData
    if (!isMotionKind(anim)) return
    if (anim === 'route' && !(isNumberList(route) && route.length >= 4)) return
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
      fadeMaterials: anim === 'puff' ? takeFadeMaterials(object) : [],
      route: anim === 'route' && isNumberList(route) ? toRouteSegments(route) : []
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
 * @returns The renderer, scene, camera, the city's outline points, its districts, moving parts
 *   and sign screen.
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
  })
  const outline = collectOutline(model)
  const movers = collectMovers(model)
  const screen = model.getObjectByName(SCREEN_NAME) ?? null

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

  return { renderer, scene, camera, outline, districts, movers, screen }
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

const SCREEN_CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1]
] as const
const corner = new THREE.Vector3()

/**
 * Where the sign's screen sits on the canvas. The screen faces the camera, so its four corners
 * project to an upright rectangle that an HTML element can cover exactly.
 * @param camera The city's camera, already fitted.
 * @param screen The screen marker, carrying its width and height from Blender.
 * @returns The screen's rectangle as fractions of the canvas.
 */
export const getScreenRect = (camera: THREE.Camera, screen: THREE.Object3D): CanvasRect => {
  const width = readNumber(screen.userData.width)
  const height = readNumber(screen.userData.height)
  camera.updateMatrixWorld(true)
  screen.updateMatrixWorld(true)
  const points = SCREEN_CORNERS.map(([side, edge]) => {
    corner
      .set((side * width) / 2, (edge * height) / 2, 0)
      .applyMatrix4(screen.matrixWorld)
      .project(camera)
    return [(corner.x + 1) / 2, (1 - corner.y) / 2]
  })
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
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
  if (kind === 'route') return getRouteProgress(fraction(seconds * speed + phase))
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
  // Blender's ground plane is three.js's x and negative z, and a turn about its up axis is the
  // same turn about three.js's y. On the way back the boat sails the course bow first again.
  if (kind === 'route') {
    const spot = getRouteSpot(mover.route, value)
    const isReturning = fraction(seconds * mover.speed + mover.phase) >= ROUTE_RETURN
    object.position.x = spot.x
    object.position.z = -spot.y
    object.rotation.y = spot.heading + (isReturning ? Math.PI : 0)
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
