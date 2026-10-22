<script setup lang="ts">
import * as THREE from 'three'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import type { Font } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import helvetikerBoldUrl from 'three/examples/fonts/helvetiker_bold.typeface.json?url'
import { getTools, getModel, getPhysic } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import SkillsCity from './SkillsCity.vue'
import { getHeroFrustum, getHeroScrollFade } from './heroFrame'
import MarketSectors from './MarketSectors.vue'
import ContourBackdrop from './ContourBackdrop.vue'
import { Github, Linkedin, Smartphone } from 'lucide-vue-next'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import { registerLightProperties } from '@/utils/lightProperties'
import { getLogoIntroPose, getSleepPose } from './logoIntro'
import {
  createRoom,
  aimSpot,
  createCornerSpot,
  addCardShading,
  createPaperTexture,
  createLogoEyelids,
  setEyelidsOpen,
  applyLogoPose
} from './introScene'
import {
  INTRO_TIMING,
  LOGO_ON_LETTERS_GAP,
  CORNER_MARGIN,
  WALL_GAP,
  PAPER_WORLD_DENSITY,
  HERO_LOOKS,
  DEFAULT_HERO_LOOK,
  HERO_MOVED_DISTANCE,
  HERO_MOVED_ANGLE,
  HERO_SCROLL_DIMMING,
  SLEEP_YAW,
  INTRO_SEEN_KEY,
  AUTO_WAKE_DELAY,
  ROOM_SIZE,
  ROOM_COLLIDER_DEPTH,
  OWNER_NAME,
  OWNER_PROFESSION,
  OWNER_SUMMARY,
  OWNER_PROFILES,
  BUILD_NOTES
} from './config'
import type { LogoJumpPath, LogoRest, HeroLook, HeroLookParts } from './types'
import { createHeroLook, registerLookElements, refreshLookElements, getNextLook } from './heroLook'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { cameraSchema } from '@/views/Tools/SceneEditor/config'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'

const canvas = ref<HTMLCanvasElement | null>(null)
const page = ref<HTMLElement | null>(null)
const hero = ref<HTMLElement | null>(null)
const heroCover = ref<HTMLElement | null>(null)
const PROFILE_ICONS: Record<string, Component> = { linkedin: Linkedin, github: Github }
const skills = ref<HTMLElement | null>(null)
const scrollToSkills = (): void => skills.value?.scrollIntoView({ behavior: 'smooth' })
const route = useRoute()
// The finish is picked in the Config panel, or with ?look= in the address to share one.
const requestedLook = typeof route.query.look === 'string' ? route.query.look : ''
const lookName = ref(requestedLook in HERO_LOOKS ? requestedLook : DEFAULT_HERO_LOOK)
const look = computed(() => HERO_LOOKS[lookName.value] ?? HERO_LOOKS[DEFAULT_HERO_LOOK])
const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

let animationId = 0
let cleanupReference: (() => void) | null = null

// Four times further back along the same view line than the original framing: an orthographic
// view looks identical, but the near plane no longer cuts the floor off above the bottom edge.
const CAMERA_X = 0.48
const CAMERA_Y = 9.57
const CAMERA_Z = 55.4
const ORBIT_TARGET_X = -0.2
const ORBIT_TARGET_Y = 1.89
const ORBIT_TARGET_Z = -0.08
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 200
const FRUSTUM_HEIGHT = 20
const FRUSTUM_MIN_WIDTH = 14
const WHITE = 0xffffff
const TARGET_WIDTH = 8
const TEXT_DEPTH = 0.8
const LETTER_SPACING = 0.3
const COLLIDER_RESTITUTION = 0.4
const COLLIDER_FRICTION = 0.6
const LINEAR_DAMPING = 4.0
const ANGULAR_DAMPING = 4.0
const PHYSICS_FPS = 60
const PHYSICS_STEP = 1 / PHYSICS_FPS
const DEFAULT_IMPULSE = 2
const IMPULSE_SCALE = 0.1
const LOGO_IMPULSE_MULTIPLIER = 0.15
const DEFAULT_TORQUE = 3
const RESET_DURATION_FRAMES = 60
const RESET_INTERVAL_FRAMES = 300
const ROOM_WALL_Z = -3.5
const BACKGROUND_COLOR = 0x141b26

type IntroStage = 'asleep' | 'jumping' | 'awake'

// Session storage can be blocked or throw in private windows; the intro then simply plays again.
const hasSeenIntro = (): boolean => {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

const rememberIntroSeen = (): void => {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, 'true')
  } catch {
    // Nothing to do: the next visit plays the intro again.
  }
}
const introStage = ref<IntroStage>('asleep')

const createOrthographicCamera = (): THREE.OrthographicCamera => {
  const { halfWidth, halfHeight } = getHeroFrustum(
    window.innerWidth / window.innerHeight,
    FRUSTUM_HEIGHT,
    FRUSTUM_MIN_WIDTH
  )
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  )
  camera.position.set(CAMERA_X, CAMERA_Y, CAMERA_Z)
  camera.lookAt(ORBIT_TARGET_X, ORBIT_TARGET_Y, ORBIT_TARGET_Z)
  return camera
}

const createResizeHandler =
  (camera: THREE.OrthographicCamera, renderer: THREE.WebGLRenderer) => (): void => {
    const { halfWidth, halfHeight } = getHeroFrustum(
      window.innerWidth / window.innerHeight,
      FRUSTUM_HEIGHT,
      FRUSTUM_MIN_WIDTH
    )
    Object.assign(camera, {
      left: -halfWidth,
      right: halfWidth,
      top: halfHeight,
      bottom: -halfHeight
    })
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

interface HeroLights {
  ambientLight: THREE.AmbientLight
  dirLight: THREE.DirectionalLight
}

// Colours, strengths and positions come from the chosen look once the scene is built.
const createLights = (scene: THREE.Scene): HeroLights => {
  const ambientLight = new THREE.AmbientLight(WHITE, 0)
  ambientLight.name = 'ambient-light'

  const dirLight = new THREE.DirectionalLight(WHITE, 0)
  dirLight.name = 'directional-light'
  dirLight.castShadow = true

  scene.add(ambientLight, dirLight)
  return { ambientLight, dirLight }
}

type PhysicsWorld = Parameters<typeof getPhysic>[0]
interface PhysicsBody {
  translation(): { x: number; y: number; z: number }
  rotation(): { x: number; y: number; z: number; w: number }
  setTranslation(t: { x: number; y: number; z: number }, wake: boolean): void
  setRotation(r: { x: number; y: number; z: number; w: number }, wake: boolean): void
  setLinvel(v: { x: number; y: number; z: number }, wake: boolean): void
  setAngvel(v: { x: number; y: number; z: number }, wake: boolean): void
  applyImpulse(impulse: { x: number; y: number; z: number }, wake: boolean): void
  applyTorqueImpulse(torque: { x: number; y: number; z: number }, wake: boolean): void
}
type BodyEntry = { body: PhysicsBody; originalPos: THREE.Vector3 }
type PhysicsBodies = Map<THREE.Object3D, BodyEntry>

const projectTriplanar = (point: THREE.Vector3, normal: THREE.Vector3): [number, number] => {
  const axisX = Math.abs(normal.x)
  const axisY = Math.abs(normal.y)
  const axisZ = Math.abs(normal.z)
  if (axisX >= axisY && axisX >= axisZ) return [point.z, point.y]
  if (axisY >= axisX && axisY >= axisZ) return [point.x, point.z]
  return [point.x, point.y]
}

const applyTriplanarGrainUVs = (mesh: THREE.Mesh): void => {
  mesh.updateWorldMatrix(true, false)
  const geometry = mesh.geometry
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const worldVertex = new THREE.Vector3()
  const worldNormal = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
  const uvArray = new Float32Array(position.count * 2)
  Array.from({ length: position.count }).forEach((_, index) => {
    worldVertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
    worldNormal.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix)
    const [u, v] = projectTriplanar(worldVertex, worldNormal)
    uvArray[index * 2] = u * PAPER_WORLD_DENSITY
    uvArray[index * 2 + 1] = v * PAPER_WORLD_DENSITY
  })
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))
}

interface Logo {
  model: THREE.Object3D
  body: PhysicsBody
  rest: LogoRest
  size: THREE.Vector3
  eyelids: THREE.Mesh[]
}

const loadLogo = async (
  scene: THREE.Scene,
  world: PhysicsWorld,
  material: THREE.Material
): Promise<Logo> => {
  const model = await getModel(scene, world, 'cnotv.glb', {
    type: 'dynamic',
    weight: 0,
    damping: LINEAR_DAMPING,
    angular: ANGULAR_DAMPING,
    restitution: COLLIDER_RESTITUTION,
    friction: COLLIDER_FRICTION,
    castShadow: true
  })

  const box = new THREE.Box3().setFromObject(model)
  const scale = TARGET_WIDTH / box.getSize(new THREE.Vector3()).x
  model.scale.setScalar(scale)
  model.updateMatrixWorld(true)

  box.setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const feetOffset = model.position.clone().sub(new THREE.Vector3(center.x, box.min.y, center.z))

  model.traverse((child) => {
    const childMesh = child as THREE.Mesh
    if (childMesh.isMesh) {
      childMesh.material = material
      childMesh.castShadow = true
      applyTriplanarGrainUVs(childMesh)
    }
  })

  const eyelids = createLogoEyelids(model, material)
  return {
    model,
    body: model.userData.body as PhysicsBody,
    rest: { feetOffset },
    size,
    eyelids
  }
}

const buildTextOptions = (font: Font) => ({
  font,
  size: 1,
  depth: TEXT_DEPTH,
  curveSegments: 8,
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.05,
  bevelSegments: 6
})

const getSpacingAfter = (index: number): number =>
  index === 2 || index === 3 ? LETTER_SPACING / 2 : LETTER_SPACING

interface Letter {
  mesh: THREE.Mesh
  body: PhysicsBody
  restY: number
  bottomOffset: number
  topOffset: number
}

const loadText = (
  scene: THREE.Scene,
  world: PhysicsWorld,
  material: THREE.Material,
  font: Font
): Letter[] => {
  const referenceGeometry = new TextGeometry('CNOTV', buildTextOptions(font))
  referenceGeometry.computeBoundingBox()
  const fullWidth = referenceGeometry.boundingBox!.max.x - referenceGeometry.boundingBox!.min.x
  referenceGeometry.dispose()
  const baseTextScale = TARGET_WIDTH / fullWidth

  const letters = ['C', 'N', 'O', 'T', 'V']
  const letterGeometries = letters.map((letter) => {
    const geometry = new TextGeometry(letter, buildTextOptions(font))
    geometry.computeBoundingBox()
    // Centred vertically so the physics box, which sits on the mesh origin, wraps the glyph
    // instead of hanging half below it into the floor.
    const { min, max } = geometry.boundingBox!
    geometry.translate(0, -(min.y + max.y) / 2, 0)
    geometry.computeBoundingBox()
    return geometry
  })

  const letterMeasurements = letterGeometries.map((geometry) => {
    const box = geometry.boundingBox!
    return {
      width: (box.max.x - box.min.x) * baseTextScale,
      height: (box.max.y - box.min.y) * baseTextScale,
      depth: (box.max.z - box.min.z) * baseTextScale,
      minX: box.min.x * baseTextScale
    }
  })

  const totalSpacings = letters.slice(0, -1).reduce((sum, _, i) => sum + getSpacingAfter(i), 0)
  const totalLetterWidth = letterMeasurements.reduce((sum, { width }) => sum + width, 0)
  const sizeCorrection = (TARGET_WIDTH - totalSpacings) / totalLetterWidth
  const textScale = baseTextScale * sizeCorrection

  let currentX = 0
  const meshes = letterGeometries.map((geometry, i) => {
    const { width, height, depth, minX } = letterMeasurements[i]
    const scaledWidth = width * sizeCorrection
    const scaledHeight = height * sizeCorrection
    const scaledDepth = depth * sizeCorrection
    const scaledMinX = minX * sizeCorrection

    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.setScalar(textScale)
    mesh.position.set(currentX - scaledMinX, 0, 0)
    mesh.castShadow = true
    mesh.visible = false
    scene.add(mesh)

    currentX += scaledWidth + (i < letters.length - 1 ? getSpacingAfter(i) : 0)

    return { mesh, scaledWidth, scaledHeight, scaledDepth }
  })

  const centerX = currentX / 2
  return meshes.map(({ mesh, scaledWidth, scaledHeight, scaledDepth }) => {
    mesh.position.x -= centerX
    applyTriplanarGrainUVs(mesh)
    const { rigidBody } = getPhysic(world, {
      type: 'dynamic',
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      size: [scaledWidth, scaledHeight, scaledDepth],
      boundary: 0.35,
      weight: 0,
      damping: LINEAR_DAMPING,
      angular: ANGULAR_DAMPING,
      restitution: COLLIDER_RESTITUTION,
      friction: COLLIDER_FRICTION
    })
    mesh.updateMatrixWorld()
    const bounds = new THREE.Box3().setFromObject(mesh)
    return {
      mesh,
      body: rigidBody as PhysicsBody,
      restY: mesh.position.y,
      bottomOffset: bounds.min.y - mesh.position.y,
      topOffset: bounds.max.y - mesh.position.y
    }
  })
}

const getLettersBounds = (letters: Letter[]): { top: number; bottom: number } => ({
  top: Math.max(...letters.map(({ restY, topOffset }) => restY + topOffset)),
  bottom: Math.min(...letters.map(({ restY, bottomOffset }) => restY + bottomOffset))
})

const getAncestors = (object: THREE.Object3D): THREE.Object3D[] =>
  object.parent ? [object, ...getAncestors(object.parent)] : [object]

const findBodyForObject = (object: THREE.Object3D, bodies: PhysicsBodies): PhysicsBody | null =>
  getAncestors(object).reduce<PhysicsBody | null>(
    (found, ancestor) => found ?? bodies.get(ancestor)?.body ?? null,
    null
  )

// Measured against the canvas rather than the window, since the canvas scrolls with the page.
const createPointerRaycaster = (event: PointerEvent, camera: THREE.Camera): THREE.Raycaster => {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const pointer = new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(pointer, camera)
  return raycaster
}

const isPointerOnObject = (event: PointerEvent, camera: THREE.Camera, object: THREE.Object3D) =>
  createPointerRaycaster(event, camera).intersectObject(object, true).length > 0

const LANDING_TIME = INTRO_TIMING.wake + INTRO_TIMING.anticipation + INTRO_TIMING.air

interface IntroDirectorOptions {
  logo: Logo
  letters: Letter[]
  path: LogoJumpPath
  spot: THREE.SpotLight
  getLook: () => HeroLook
  setLightLevels: (progress: number) => void
  onAwake: () => void
}

/**
 * Drives the sleeping logo, its wake up and jump, the letters showing once it lands and the
 * lights coming up, then reports when it is done.
 * @param options Everything the intro moves.
 * @returns A per-frame update taking seconds since the wake click, or null while asleep.
 */
const createIntroDirector = ({
  logo,
  letters,
  path,
  spot,
  getLook,
  setLightLevels,
  onAwake
}: IntroDirectorOptions) => {
  const spotTarget = new THREE.Vector3()
  const startFeet = new THREE.Vector3(...path.start)
  // Awake, the spot lights the floor under the letters, so its pool is centred beneath them.
  const endPool = new THREE.Vector3(path.end[0], path.start[1], path.end[2])

  return (sinceWake: number | null): boolean => {
    const pose = sinceWake === null ? getSleepPose(path) : getLogoIntroPose(sinceWake, path)
    applyLogoPose(logo.model, pose, logo.rest)
    setEyelidsOpen(logo.eyelids, pose.eyeOpenness)
    const hasLanded = sinceWake !== null && sinceWake >= LANDING_TIME
    letters.forEach(({ mesh }) => (mesh.visible = hasLanded))

    aimSpot(spot, spotTarget.lerpVectors(startFeet, endPool, pose.lightProgress), getLook().spot)
    setLightLevels(pose.lightProgress)

    if (pose.done) onAwake()
    return pose.done
  }
}

// Turned by SLEEP_YAW, the logo's footprint grows wider and deeper; both are measured so its
// side clears the screen edge and its back corner touches the wall.
const getJumpPath = (logo: Logo, letters: Letter[], halfWidth: number): LogoJumpPath => {
  const { top, bottom } = getLettersBounds(letters)
  const [cosine, sine] = [Math.cos(SLEEP_YAW), Math.sin(SLEEP_YAW)]
  const turnedWidth = logo.size.x * cosine + logo.size.z * sine
  const turnedDepth = logo.size.x * sine + logo.size.z * cosine
  return {
    start: [
      Math.min(0, -halfWidth + CORNER_MARGIN + turnedWidth / 2),
      bottom,
      ROOM_WALL_Z + turnedDepth / 2 + WALL_GAP
    ],
    end: [0, top + LOGO_ON_LETTERS_GAP, 0]
  }
}

// Solid floor and back wall where the room draws them, so a clicked letter or logo stops
// against the surface it is seen on instead of sinking through it.
const createRoomColliders = (world: PhysicsWorld, floorY: number): void => {
  getPhysic(world, {
    type: 'fixed',
    position: [0, floorY - ROOM_COLLIDER_DEPTH / 2, ROOM_WALL_Z + ROOM_SIZE / 2],
    size: [ROOM_SIZE, ROOM_COLLIDER_DEPTH, ROOM_SIZE]
  })
  getPhysic(world, {
    type: 'fixed',
    position: [0, floorY + ROOM_SIZE / 2, ROOM_WALL_Z - ROOM_COLLIDER_DEPTH / 2],
    size: [ROOM_SIZE, ROOM_SIZE, ROOM_COLLIDER_DEPTH]
  })
}

// The logo's body waits at the landing spot from the start, so it never overlaps the letters'
// bodies and shoves them out of place while the mesh is still asleep in the corner.
const parkLogoBody = (logo: Logo, path: LogoJumpPath): void => {
  applyLogoPose(logo.model, getLogoIntroPose(Infinity, path), logo.rest)
  const { x, y, z } = logo.model.position
  logo.body.setTranslation({ x, y, z }, true)
}

const handOverToPhysics = (logo: Logo, letters: Letter[], bodies: PhysicsBodies): void => {
  const entries: [THREE.Object3D, PhysicsBody][] = [
    [logo.model, logo.body],
    ...letters.map(({ mesh, body }): [THREE.Object3D, PhysicsBody] => [mesh, body])
  ]
  entries.forEach(([object, body]) => {
    const { x, y, z } = body.translation()
    bodies.set(object, { body, originalPos: new THREE.Vector3(x, y, z) })
  })
}

type PhysicsConfig = { impulse: number; torque: number }
type HeroConfig = PhysicsConfig & { look: string }

const heroConfigSchema = {
  look: {
    label: 'Hero look',
    component: 'ButtonSelector',
    options: Object.entries(HERO_LOOKS).map(([value, { label }]) => ({ value, label }))
  },
  impulse: { label: 'Movement Speed', min: 0, max: 500, step: 1 },
  torque: { label: 'Rotation Speed', min: 0, max: 100, step: 0.5 }
}

const createClickHandler =
  (camera: THREE.OrthographicCamera, bodies: PhysicsBodies, config: { value: PhysicsConfig }) =>
  (event: PointerEvent): void => {
    const raycaster = createPointerRaycaster(event, camera)
    const targets = [...bodies.keys()].flatMap((object) =>
      object instanceof THREE.Group ? [...object.children] : [object]
    )
    const hits = raycaster.intersectObjects(targets, true)
    if (hits.length === 0) return

    const hit = hits[0]
    const body = findBodyForObject(hit.object, bodies)
    if (!body) return

    const center = body.translation()
    const offset = new THREE.Vector3(
      hit.point.x - center.x,
      hit.point.y - center.y,
      hit.point.z - center.z
    )
    const direction = offset.clone().negate().normalize()
    const bodyOwner = [...bodies.entries()].find(([, entry]) => entry.body === body)?.[0]
    const impulseScale =
      (bodyOwner instanceof THREE.Group ? LOGO_IMPULSE_MULTIPLIER : 1) * IMPULSE_SCALE
    const magnitude = config.value.impulse * impulseScale

    body.applyImpulse(
      {
        x: direction.x * magnitude,
        y: direction.y * magnitude,
        z: direction.z * magnitude
      },
      true
    )

    const offsetLength = offset.length()
    const torque = offsetLength * config.value.torque * impulseScale
    body.applyTorqueImpulse(
      {
        x: offset.y * torque,
        y: -offset.x * torque,
        z: offset.x * torque
      },
      true
    )
  }

interface RegisterPanelsOptions {
  camera: THREE.OrthographicCamera
  orbit: OrbitControls
  ambientLight: THREE.AmbientLight
  dirLight: THREE.DirectionalLight
  spot: THREE.SpotLight
}

const registerPanels = ({
  camera,
  orbit,
  ambientLight,
  dirLight,
  spot
}: RegisterPanelsOptions): void => {
  const orthoCameraSchema = {
    position: cameraSchema.position,
    orbitTarget: cameraSchema.orbitTarget,
    orbitEnabled: cameraSchema.orbitEnabled
  }
  registerCameraProperties({ camera, orbit, schema: orthoCameraSchema })

  registerLightProperties({
    light: ambientLight,
    name: 'ambient-light',
    title: 'Ambient Light'
  })
  registerLightProperties({
    light: dirLight,
    name: 'directional-light',
    title: 'Directional Light'
  })
  const debugStore = useDebugSceneStore()
  debugStore.registerSceneElements(camera as unknown as THREE.Camera, [
    ambientLight,
    dirLight,
    spot
  ])
}

// Every few seconds the logo and letters ease back to their places. When that brings back
// something that was knocked away, onReturn is called, so the page can mark the moment.
const createResetTimeline = (bodies: PhysicsBodies, onReturn: () => void) => {
  const timelineManager = createTimelineManager()
  let resetFrame = 0
  const resetStartPositions = new Map<THREE.Object3D, THREE.Vector3>()
  const resetStartRotations = new Map<THREE.Object3D, THREE.Quaternion>()
  const identityQuat = new THREE.Quaternion()
  const scratchPos = new THREE.Vector3()
  const scratchRot = new THREE.Quaternion()

  timelineManager.addAction({
    interval: [RESET_DURATION_FRAMES, RESET_INTERVAL_FRAMES - RESET_DURATION_FRAMES],
    actionStart: () => {
      resetFrame = 0
      resetStartPositions.clear()
      resetStartRotations.clear()
      const wasMoved = [...bodies.values()].some(({ body, originalPos }) => {
        const { x, y, z } = body.translation()
        const rotation = body.rotation()
        const turned = scratchRot
          .set(rotation.x, rotation.y, rotation.z, rotation.w)
          .angleTo(identityQuat)
        return (
          originalPos.distanceTo(scratchPos.set(x, y, z)) > HERO_MOVED_DISTANCE ||
          turned > HERO_MOVED_ANGLE
        )
      })
      if (wasMoved) onReturn()
      bodies.forEach(({ body }, mesh) => {
        const pos = body.translation()
        const rot = body.rotation()
        resetStartPositions.set(mesh, new THREE.Vector3(pos.x, pos.y, pos.z))
        resetStartRotations.set(mesh, new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
      })
    },
    action: () => {
      resetFrame++
      const progress = Math.min(1, resetFrame / RESET_DURATION_FRAMES)
      bodies.forEach(({ body, originalPos }, mesh) => {
        const startPos = resetStartPositions.get(mesh)
        const startRot = resetStartRotations.get(mesh)
        if (!startPos || !startRot) return
        scratchPos.copy(startPos).lerp(originalPos, progress)
        scratchRot.copy(startRot).slerp(identityQuat, progress)
        body.setTranslation({ x: scratchPos.x, y: scratchPos.y, z: scratchPos.z }, true)
        body.setRotation(
          { x: scratchRot.x, y: scratchRot.y, z: scratchRot.z, w: scratchRot.w },
          true
        )
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      })
    }
  })

  return timelineManager
}

const init = async (canvasElement: HTMLCanvasElement): Promise<void> => {
  const { renderer, scene, world } = await getTools({
    canvas: canvasElement,
    resize: false,
    onProgress: handleProgress
  })

  renderer.setClearColor(BACKGROUND_COLOR, 1)
  renderer.shadowMap.enabled = true
  // Plain PCF honours each light's shadow radius, which the soft variant ignores.
  renderer.shadowMap.type = THREE.PCFShadowMap
  scene.background = null

  const camera = createOrthographicCamera()
  const { ambientLight, dirLight } = createLights(scene)
  const grainTexture = createPaperTexture()
  const contentMaterial = new THREE.MeshStandardMaterial()
  const shading = addCardShading(contentMaterial)

  const bodies: PhysicsBodies = new Map()
  const logo = await loadLogo(scene, world, contentMaterial)
  const font = await new FontLoader().loadAsync(helvetikerBoldUrl)
  const letters = loadText(scene, world, contentMaterial, font)
  const path = getJumpPath(logo, letters, camera.right)
  parkLogoBody(logo, path)

  const room = createRoom(scene, path.start[1], ROOM_WALL_Z, grainTexture)
  createRoomColliders(world, path.start[1])
  const spot = createCornerSpot(scene)
  spot.target.position.set(...path.start)

  const [wallMaterial, floorMaterial] = room.materials
  const lookParts: HeroLookParts = {
    ambientLight,
    keyLight: dirLight,
    spot,
    wallMaterial,
    floorMaterial,
    roomPaper: room.paper,
    logoMaterial: contentMaterial,
    logoPaper: grainTexture,
    emboss: shading.emboss,
    rim: shading.rim,
    reflection: shading.reflection,
    reflectionMap: shading.reflectionMap,
    reflectionShift: shading.reflectionShift,
    reflectionBlur: shading.reflectionBlur
  }
  const heroLook = createHeroLook(lookParts, look.value)
  const stopLookWatch = watch(look, (next) =>
    heroLook.transitionTo(next, () => refreshLookElements(lookParts))
  )

  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(ORBIT_TARGET_X, ORBIT_TARGET_Y, ORBIT_TARGET_Z)
  orbit.update()
  orbit.enabled = false
  // OrbitControls claims every touch on its canvas even while disabled, which stops a finger on
  // the hero from scrolling the page on a phone; vertical drags go back to the page.
  renderer.domElement.style.touchAction = 'pan-y'

  const heroConfig = createReactiveConfig<HeroConfig>({
    look: lookName.value,
    impulse: DEFAULT_IMPULSE,
    torque: DEFAULT_TORQUE
  })
  registerViewConfig(
    route.name as string,
    heroConfig as ReturnType<typeof createReactiveConfig>,
    heroConfigSchema
  )
  const stopLookPick = watch(
    () => heroConfig.value.look,
    (name) => (lookName.value = name)
  )
  registerPanels({ camera, orbit, ambientLight, dirLight, spot })
  registerLookElements(lookParts)

  // Each time the knocked logo or letters come back, the hero changes to the next look.
  const timelineManager = createResetTimeline(bodies, () => {
    heroConfig.value.look = getNextLook(heroConfig.value.look, Object.keys(HERO_LOOKS))
  })

  const onResize = createResizeHandler(camera, renderer)
  const clock = new THREE.Clock()
  const onPhysicsPointerDown = createClickHandler(camera, bodies, heroConfig)
  let wokenAt: number | null = null
  const wakeUp = (): void => {
    if (introStage.value !== 'asleep') return
    introStage.value = 'jumping'
    wokenAt = clock.elapsedTime
  }
  // A visitor who already watched the intro in this session lands straight on the awake page:
  // waking up infinitely long ago resolves the whole intro on the first frame.
  if (hasSeenIntro()) {
    introStage.value = 'jumping'
    wokenAt = -Infinity
  }
  const onPointerDown = (event: PointerEvent): void => {
    if (introStage.value === 'awake') return onPhysicsPointerDown(event)
    if (isPointerOnObject(event, camera, logo.model)) wakeUp()
  }
  const updateIntro = createIntroDirector({
    logo,
    letters,
    path,
    spot,
    getLook: () => look.value,
    setLightLevels: heroLook.setLightLevels,
    onAwake: () => {
      introStage.value = 'awake'
      rememberIntroSeen()
      handOverToPhysics(logo, letters, bodies)
    }
  })
  window.addEventListener('resize', onResize)
  canvasElement.addEventListener('pointerdown', onPointerDown)

  let accumulator = 0
  let frame = 0

  const runAnimation = () => {
    animationId = requestAnimationFrame(runAnimation)
    frame++
    const delta = clock.getDelta()

    accumulator += delta
    const steps = Math.floor(accumulator / PHYSICS_STEP)
    Array.from({ length: steps }).forEach(() => world.step())
    accumulator -= steps * PHYSICS_STEP

    animateTimeline(timelineManager, frame)
    heroLook.update(clock.elapsedTime)

    if (clock.elapsedTime >= AUTO_WAKE_DELAY) wakeUp()
    if (introStage.value !== 'awake') {
      updateIntro(wokenAt === null ? null : clock.elapsedTime - wokenAt)
    }
    // Scrolling away dims the room and then closes a cover of the next section's colour over it.
    // The dimming is a filter on the canvas, not on the lights, so the Lights panel keeps control.
    const fade = getHeroScrollFade(
      page.value?.scrollTop ?? 0,
      hero.value?.clientHeight ?? 0,
      HERO_SCROLL_DIMMING
    )
    canvasElement.style.filter = fade.light < 1 ? `brightness(${fade.light})` : ''
    if (heroCover.value) heroCover.value.style.opacity = String(fade.cover)

    bodies.forEach(({ body }, mesh) => {
      const pos = body.translation()
      const rot = body.rotation()
      mesh.position.set(pos.x, pos.y, pos.z)
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    })

    renderer.render(scene, camera)
  }
  runAnimation()
  loadingVisible.value = false

  cleanupReference = () => {
    window.removeEventListener('resize', onResize)
    canvasElement.removeEventListener('pointerdown', onPointerDown)
    grainTexture.dispose()
    contentMaterial.dispose()
    stopLookWatch()
    stopLookPick()
    heroLook.dispose()
    room.materials.forEach((material) => material.dispose())
    room.paper.dispose()
    room.meshes.forEach((mesh) => mesh.geometry.dispose())
    logo.eyelids.forEach((eyelid) => eyelid.geometry.dispose())
    renderer.dispose()
  }
}

onMounted(() => {
  if (canvas.value) init(canvas.value)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  unregisterViewConfig(route.name as string)
  useElementPropertiesStore().clearAllElementProperties()
  useDebugSceneStore().clearSceneElements()
  cleanupReference?.()
  cleanupReference = null
})
</script>

<template>
  <main
    ref="page"
    class="landing-page"
    :class="{ 'landing-page--awake': introStage === 'awake', 'landing-page--ink': look.ink }"
  >
    <header ref="hero" class="landing-page__hero">
      <canvas ref="canvas" class="landing-page__canvas" />
      <h1 class="landing-page__name">{{ OWNER_NAME }}</h1>
      <p class="landing-page__profession">{{ OWNER_PROFESSION }}</p>
      <a
        class="landing-page__scroll"
        href="#skills"
        aria-label="Scroll to skills"
        @click.prevent="scrollToSkills"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="landing-page__scroll-icon">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
      <div ref="heroCover" class="landing-page__hero-cover" aria-hidden="true" />
    </header>
    <div class="landing-page__content">
      <ContourBackdrop />
      <section
        id="skills"
        ref="skills"
        class="landing-page__section"
        aria-labelledby="skills-title"
      >
        <!-- The display on the city's sign shows these; they stay in the page for screen readers and search. -->
        <h2 id="skills-title" class="sr-only">What I work on</h2>
        <p class="sr-only">{{ OWNER_SUMMARY }}</p>
        <p class="landing-page__turn">
          <Smartphone class="landing-page__turn-icon" aria-hidden="true" />
          Turn your phone to explore the city
        </p>
        <SkillsCity />
      </section>
      <MarketSectors class="landing-page__section" />
      <footer class="landing-page__footer">
        <nav class="landing-page__profiles" aria-label="Profiles">
          <a
            v-for="profile in OWNER_PROFILES"
            :key="profile.label"
            class="landing-page__profile"
            :href="profile.url"
            :aria-label="profile.label"
            :title="profile.label"
            target="_blank"
            rel="me noopener"
          >
            <component
              :is="PROFILE_ICONS[profile.icon]"
              class="landing-page__profile-icon"
              aria-hidden="true"
            />
          </a>
        </nav>
        <nav class="landing-page__notes" aria-label="How this page was built">
          <ul class="landing-page__notes-list">
            <li v-for="note in BUILD_NOTES" :key="note.url">
              <a class="landing-page__note" :href="note.url" target="_blank" rel="noopener">
                {{ note.label }}
              </a>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
    <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
  </main>
</template>

<style scoped>
.landing-page {
  position: fixed;
  inset: 0;
  overflow: hidden auto;
  overscroll-behavior: contain;
  background-color: var(--color-canvas-overlay-surface);
  font-family: var(--font-mono);
}

.landing-page__hero {
  position: relative;
  height: 100dvh;
}

.landing-page__canvas {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-paper-dark);
}

.landing-page__name,
.landing-page__profession,
.landing-page__scroll {
  opacity: 0;
  transition:
    opacity var(--transition-game-phase) ease-out,
    color var(--transition-hero-look) ease-in-out,
    text-shadow var(--transition-hero-look) ease-in-out;
}

.landing-page--awake .landing-page__name,
.landing-page--awake .landing-page__profession,
.landing-page--awake .landing-page__scroll {
  opacity: 1;
}

.landing-page__name,
.landing-page__profession {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--font-sign);
  font-weight: bold;
  text-shadow: var(--shadow-text-canvas-overlay);
  text-transform: uppercase;
}

/* On a light paper finish the hero's words are printed in ink rather than lit. */
.landing-page--ink .landing-page__name,
.landing-page--ink .landing-page__profession,
.landing-page--ink .landing-page__scroll {
  color: var(--color-hero-ink);
  text-shadow: none;
}

.landing-page__name {
  top: 76%;
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-xl);
  letter-spacing: 0.3em;
}

.landing-page__profession {
  top: calc(76% + var(--spacing-12));
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-sm);
  letter-spacing: 0.35em;
}

.landing-page__scroll {
  position: absolute;
  bottom: var(--spacing-6);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-2);
  color: var(--color-canvas-overlay-muted);
}

.landing-page:not(.landing-page--awake) .landing-page__scroll {
  pointer-events: none;
}

.landing-page__scroll:hover,
.landing-page__scroll:focus-visible {
  color: var(--color-canvas-overlay-accent);
}

.landing-page__scroll-icon {
  display: block;
  width: var(--spacing-8);
  height: var(--spacing-8);
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.landing-page__section {
  box-sizing: border-box;
  max-width: 72rem;
  margin: 0 auto;
  padding: var(--spacing-16) var(--spacing-6);
}

/* Positioned so it paints over the contour map behind the content. */
.landing-page__turn {
  display: none;
  position: relative;
}

/* Held upright, a phone shows the city too small to read its districts, so it suggests landscape. */
@media (orientation: portrait) and (width <= 640px) {
  .landing-page__turn {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 0 var(--spacing-4);
    gap: var(--spacing-2);
    color: var(--color-canvas-overlay-muted);
    font-size: var(--font-size-2xs);
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
}

.landing-page__turn-icon {
  width: var(--spacing-6);
  height: var(--spacing-6);
}

/* Everything under the hero, over the contour map that sticks behind it. */
.landing-page__hero-cover {
  position: absolute;
  inset: 0;
  opacity: 0;
  background-color: var(--color-canvas-overlay-surface);
  pointer-events: none;
}

.landing-page__content {
  position: relative;
}

/* Positioned so it paints over the sticky map, like the sections above it. */
.landing-page__footer {
  position: relative;
  display: grid;
  justify-items: center;
  padding: var(--spacing-8) var(--spacing-6) var(--spacing-12);
  gap: var(--spacing-6);
}

.landing-page__profiles {
  display: flex;
  gap: var(--spacing-8);
}

.landing-page__notes {
  text-align: center;
}

.landing-page__notes-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: 0;
  padding: 0;
  list-style: none;
  gap: var(--spacing-2) var(--spacing-6);
}

.landing-page__note {
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.landing-page__note:hover,
.landing-page__note:focus-visible {
  text-decoration: underline;
}

.landing-page__profile {
  display: inline-flex;
  padding: var(--spacing-2);
  color: var(--color-canvas-overlay-muted);
}

.landing-page__profile:hover,
.landing-page__profile:focus-visible {
  color: var(--color-canvas-overlay-accent);
}

.landing-page__profile-icon {
  width: var(--spacing-6);
  height: var(--spacing-6);
  stroke-width: 1.5;
}

@media (prefers-reduced-motion: no-preference) {
  .landing-page__scroll-icon {
    animation: landing-page-bob 2s ease-in-out infinite;
  }

  .landing-page__turn-icon {
    animation: landing-page-turn 2.4s ease-in-out infinite;
  }
}

/* The phone tips over to landscape, holds, and stands back up. */
@keyframes landing-page-turn {
  30%,
  70% {
    transform: rotate(-90deg);
  }
}

@keyframes landing-page-bob {
  50% {
    transform: translateY(var(--spacing-1-5));
  }
}
</style>
