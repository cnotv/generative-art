<script setup lang="ts">
import * as THREE from 'three'
import { ref, onMounted, onUnmounted } from 'vue'
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
import {
  CodeXml,
  Workflow,
  Bot,
  Pointer,
  Container,
  Languages,
  Tags,
  Landmark,
  RadioTower,
  Newspaper,
  Scale,
  Shield,
  Building2
} from 'lucide-vue-next'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import { registerLightProperties } from '@/utils/lightProperties'
import { getLogoIntroPose, getSleepPose } from './logoIntro'
import {
  createRoom,
  aimSpot,
  createCornerSpot,
  createLogoEyelids,
  setEyelidsOpen,
  applyLogoPose
} from './introScene'
import {
  INTRO_TIMING,
  LOGO_ON_LETTERS_GAP,
  CORNER_MARGIN,
  WALL_GAP,
  SLEEP_AMBIENT_INTENSITY,
  SLEEP_DIRECTIONAL_INTENSITY,
  ROOM_WALL_COLOR,
  ROOM_ROUGHNESS,
  SLEEP_YAW,
  ROOM_SIZE,
  ROOM_COLLIDER_DEPTH,
  OWNER_NAME,
  OWNER_PROFESSION,
  SKILL_AREAS,
  PRODUCT_SECTORS
} from './config'
import type { LogoJumpPath, LogoRest } from './types'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { cameraSchema } from '@/views/Tools/SceneEditor/config'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { ElementPropertiesConfig } from '@/stores/elementProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'

const canvas = ref<HTMLCanvasElement | null>(null)
const skills = ref<HTMLElement | null>(null)
const scrollToSkills = (): void => skills.value?.scrollIntoView({ behavior: 'smooth' })
const ICONS: Record<string, Component> = {
  code: CodeXml,
  pipeline: Workflow,
  agent: Bot,
  pointer: Pointer,
  cluster: Container,
  language: Languages,
  classify: Tags,
  bank: Landmark,
  telco: RadioTower,
  publisher: Newspaper,
  governance: Scale,
  defense: Shield,
  public: Building2
}
const formatIndex = (index: number): string => String(index + 1).padStart(2, '0')
const route = useRoute()
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
const WHITE = 0xffffff
const AMBIENT_INTENSITY = 0.8
const DIR_LIGHT_INTENSITY = 1.2
const DIR_LIGHT_POS = 5
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
const GRAIN_TEXTURE_SIZE = 256
const GRAIN_WORLD_DENSITY = 1.5
const GRAIN_MIN = 90
const GRAIN_MAX = 255

type IntroStage = 'asleep' | 'jumping' | 'awake'
const introStage = ref<IntroStage>('asleep')

const createOrthographicCamera = (): THREE.OrthographicCamera => {
  const aspect = window.innerWidth / window.innerHeight
  const halfH = FRUSTUM_HEIGHT / 2
  const halfW = halfH * aspect
  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, CAMERA_NEAR, CAMERA_FAR)
  camera.position.set(CAMERA_X, CAMERA_Y, CAMERA_Z)
  camera.lookAt(ORBIT_TARGET_X, ORBIT_TARGET_Y, ORBIT_TARGET_Z)
  return camera
}

const createResizeHandler =
  (camera: THREE.OrthographicCamera, renderer: THREE.WebGLRenderer) => (): void => {
    const halfH = FRUSTUM_HEIGHT / 2
    const newHalfW = halfH * (window.innerWidth / window.innerHeight)
    camera.left = -newHalfW
    camera.right = newHalfW
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

const createLights = (scene: THREE.Scene) => {
  const ambientLight = new THREE.AmbientLight(WHITE, AMBIENT_INTENSITY)
  ambientLight.name = 'ambient-light'
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(WHITE, DIR_LIGHT_INTENSITY)
  dirLight.name = 'directional-light'
  dirLight.position.set(DIR_LIGHT_POS * 2, DIR_LIGHT_POS / 2, DIR_LIGHT_POS)
  dirLight.castShadow = true
  scene.add(dirLight)

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

const createGrainTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = GRAIN_TEXTURE_SIZE
  canvas.height = GRAIN_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create 2D context for grain texture')

  const imageData = context.createImageData(GRAIN_TEXTURE_SIZE, GRAIN_TEXTURE_SIZE)
  Array.from({ length: GRAIN_TEXTURE_SIZE * GRAIN_TEXTURE_SIZE }).forEach((_, index) => {
    const value = GRAIN_MIN + Math.random() * (GRAIN_MAX - GRAIN_MIN)
    const offset = index * 4
    imageData.data[offset] = value
    imageData.data[offset + 1] = value
    imageData.data[offset + 2] = value
    imageData.data[offset + 3] = 255
  })
  context.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

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
    uvArray[index * 2] = u * GRAIN_WORLD_DENSITY
    uvArray[index * 2 + 1] = v * GRAIN_WORLD_DENSITY
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

interface IntroDirectorOptions {
  logo: Logo
  path: LogoJumpPath
  lights: { ambientLight: THREE.AmbientLight; dirLight: THREE.DirectionalLight }
  spot: THREE.SpotLight
  onAwake: () => void
}

/**
 * Drives the sleeping logo, its wake up and jump onto the letters and the lights coming up,
 * then reports when it is done.
 * @param options Everything the intro moves.
 * @returns A per-frame update taking seconds since the wake click, or null while asleep.
 */
const createIntroDirector = ({ logo, path, lights, spot, onAwake }: IntroDirectorOptions) => {
  const spotTarget = new THREE.Vector3()
  const startFeet = new THREE.Vector3(...path.start)
  const endFeet = new THREE.Vector3(...path.end)

  return (sinceWake: number | null): boolean => {
    const pose = sinceWake === null ? getSleepPose(path) : getLogoIntroPose(sinceWake, path)
    applyLogoPose(logo.model, pose, logo.rest)
    setEyelidsOpen(logo.eyelids, pose.eyeOpenness)

    aimSpot(spot, spotTarget.lerpVectors(startFeet, endFeet, pose.lightProgress))
    lights.ambientLight.intensity = THREE.MathUtils.lerp(
      SLEEP_AMBIENT_INTENSITY,
      AMBIENT_INTENSITY,
      pose.lightProgress
    )
    lights.dirLight.intensity = THREE.MathUtils.lerp(
      SLEEP_DIRECTIONAL_INTENSITY,
      DIR_LIGHT_INTENSITY,
      pose.lightProgress
    )

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

const physicsConfigSchema = {
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
  contentMaterial: THREE.MeshStandardMaterial
}

const createContentConfig = (
  contentMaterial: THREE.MeshStandardMaterial,
  title: string
): ElementPropertiesConfig => ({
  title,
  schema: {
    color: { color: true, label: 'Color' },
    metalness: { min: 0, max: 1, step: 0.01, label: 'Metalness' },
    roughness: { min: 0, max: 1, step: 0.01, label: 'Roughness' }
  },
  getValue: (path) => {
    if (path === 'color') return contentMaterial.color.getHex()
    if (path === 'metalness') return contentMaterial.metalness
    if (path === 'roughness') return contentMaterial.roughness
    return undefined
  },
  updateValue: (path, value) => {
    if (path === 'color') contentMaterial.color.set(value as number)
    if (path === 'metalness') contentMaterial.metalness = value as number
    if (path === 'roughness') contentMaterial.roughness = value as number
  }
})

const registerPanels = ({
  camera,
  orbit,
  ambientLight,
  dirLight,
  contentMaterial
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
  debugStore.registerSceneElements(camera as unknown as THREE.Camera, [ambientLight, dirLight])
  debugStore.addSceneElement(
    { name: 'logo', type: 'Group', hidden: false },
    createContentConfig(contentMaterial, 'Logo')
  )
  debugStore.addSceneElement(
    { name: 'cnotv-text', type: 'Group', hidden: false },
    createContentConfig(contentMaterial, 'CNOTV Text')
  )
}

const createResetTimeline = (bodies: PhysicsBodies) => {
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  scene.background = null

  const camera = createOrthographicCamera()
  const { ambientLight, dirLight } = createLights(scene)
  const grainTexture = createGrainTexture()
  const contentMaterial = new THREE.MeshStandardMaterial({
    color: ROOM_WALL_COLOR,
    roughness: ROOM_ROUGHNESS,
    map: grainTexture,
    roughnessMap: grainTexture
  })

  const bodies: PhysicsBodies = new Map()
  const logo = await loadLogo(scene, world, contentMaterial)
  const font = await new FontLoader().loadAsync(helvetikerBoldUrl)
  const letters = loadText(scene, world, contentMaterial, font)
  const path = getJumpPath(logo, letters, camera.right)
  parkLogoBody(logo, path)

  const room = createRoom(scene, path.start[1], ROOM_WALL_Z)
  createRoomColliders(world, path.start[1])
  const spot = createCornerSpot(scene, new THREE.Vector3(...path.start))

  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(ORBIT_TARGET_X, ORBIT_TARGET_Y, ORBIT_TARGET_Z)
  orbit.update()
  orbit.enabled = false

  const physicsConfig = createReactiveConfig<PhysicsConfig>({
    impulse: DEFAULT_IMPULSE,
    torque: DEFAULT_TORQUE
  })
  registerViewConfig(
    route.name as string,
    physicsConfig as ReturnType<typeof createReactiveConfig>,
    physicsConfigSchema
  )
  registerPanels({ camera, orbit, ambientLight, dirLight, contentMaterial })

  const timelineManager = createResetTimeline(bodies)

  const onResize = createResizeHandler(camera, renderer)
  const clock = new THREE.Clock()
  const onPhysicsPointerDown = createClickHandler(camera, bodies, physicsConfig)
  let wokenAt: number | null = null
  const onPointerDown = (event: PointerEvent): void => {
    if (introStage.value === 'awake') return onPhysicsPointerDown(event)
    if (introStage.value === 'asleep' && isPointerOnObject(event, camera, logo.model)) {
      introStage.value = 'jumping'
      wokenAt = clock.elapsedTime
    }
  }
  const updateIntro = createIntroDirector({
    logo,
    path,
    lights: { ambientLight, dirLight },
    spot,
    onAwake: () => {
      introStage.value = 'awake'
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

    if (introStage.value !== 'awake') {
      updateIntro(wokenAt === null ? null : clock.elapsedTime - wokenAt)
    }

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
    room.materials.forEach((material) => material.dispose())
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
  <main class="landing-page" :class="{ 'landing-page--awake': introStage === 'awake' }">
    <header class="landing-page__hero">
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
    </header>
    <section id="skills" ref="skills" class="landing-page__section" aria-labelledby="skills-title">
      <p class="landing-page__eyebrow">Knowledge</p>
      <h2 id="skills-title" class="landing-page__heading">What I work on</h2>
      <ol class="landing-page__skills">
        <li v-for="(area, index) in SKILL_AREAS" :key="area.title" class="landing-page__skill">
          <span class="landing-page__skill-index">{{ formatIndex(index) }}</span>
          <component :is="ICONS[area.icon]" class="landing-page__skill-icon" aria-hidden="true" />
          <h3 class="landing-page__skill-title">{{ area.title }}</h3>
          <p class="landing-page__skill-line">{{ area.line }}</p>
        </li>
      </ol>
    </section>
    <section class="landing-page__section" aria-labelledby="sectors-title">
      <p class="landing-page__eyebrow">Market knowledge</p>
      <h2 id="sectors-title" class="landing-page__heading">Products in daily use at</h2>
      <ul class="landing-page__sectors">
        <li v-for="sector in PRODUCT_SECTORS" :key="sector.title" class="landing-page__sector">
          <component
            :is="ICONS[sector.icon]"
            class="landing-page__sector-icon"
            aria-hidden="true"
          />
          <span class="landing-page__sector-title">{{ sector.title }}</span>
        </li>
      </ul>
    </section>
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

/* Scrolling down only opens up once the logo has woken up and the hero is shown. */
.landing-page:not(.landing-page--awake) {
  overflow: hidden;
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
  transition: opacity var(--transition-game-phase) ease-out;
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
  text-shadow: var(--shadow-text-canvas-overlay);
  text-transform: uppercase;
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

.landing-page__eyebrow {
  margin: 0 0 var(--spacing-2);
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-xs);
  letter-spacing: 0.35em;
  text-transform: uppercase;
}

.landing-page__heading {
  margin: 0 0 var(--spacing-8);
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-xl);
  font-weight: normal;
  letter-spacing: 0.12em;
}

.landing-page__skills,
.landing-page__sectors {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: var(--spacing-4);
}

.landing-page__skills {
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.landing-page__skill {
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  transition: border-color var(--transition-fast) ease-out;
}

.landing-page__skill:last-child {
  grid-column: 1 / -1;
}

.landing-page__skill:hover {
  border-color: var(--color-canvas-overlay-muted);
}

.landing-page__skill-index {
  position: absolute;
  top: var(--spacing-4);
  right: var(--spacing-4);
  color: var(--color-canvas-overlay-border);
  font-size: var(--font-size-lg);
}

.landing-page__skill-icon,
.landing-page__sector-icon {
  color: var(--color-canvas-overlay-accent);
  stroke-width: 1.25;
}

.landing-page__skill-icon {
  width: var(--spacing-8);
  height: var(--spacing-8);
}

.landing-page__skill-title {
  margin: 0;
  color: var(--color-canvas-overlay-accent);
  font-size: var(--font-size-md);
  font-weight: normal;
}

.landing-page__skill-line {
  margin: 0;
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.landing-page__sectors {
  grid-template-columns: repeat(3, 1fr);
}

@media (width <= 640px) {
  .landing-page__sectors {
    grid-template-columns: repeat(2, 1fr);
  }
}

.landing-page__sector {
  display: grid;
  justify-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-8) var(--spacing-4);
  border-top: var(--spacing-px) solid var(--color-canvas-overlay-border);
  text-align: center;
}

.landing-page__sector-icon {
  width: var(--spacing-12);
  height: var(--spacing-12);
}

.landing-page__sector-title {
  color: var(--color-canvas-overlay-muted);
  font-size: var(--font-size-sm);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

@media (prefers-reduced-motion: no-preference) {
  .landing-page__scroll-icon {
    animation: landing-page-bob 2s ease-in-out infinite;
  }

  @supports (animation-timeline: view()) {
    .landing-page__skill,
    .landing-page__sector {
      animation: landing-page-reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 70%;
    }
  }
}

@keyframes landing-page-bob {
  50% {
    transform: translateY(var(--spacing-1-5));
  }
}

@keyframes landing-page-reveal {
  from {
    opacity: 0;
    transform: translateY(var(--spacing-8));
  }
}
</style>
