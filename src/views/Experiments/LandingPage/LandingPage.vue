<script setup lang="ts">
import * as THREE from 'three'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import type { Font } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import helvetikerBoldUrl from 'three/examples/fonts/helvetiker_bold.typeface.json?url'
import { getTools, getWalls, getModel, getPhysic } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import { registerLightProperties } from '@/utils/lightProperties'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { cameraSchema } from '@/views/Tools/SceneEditor/config'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { ElementPropertiesConfig } from '@/stores/elementProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'

const canvas = ref<HTMLCanvasElement | null>(null)
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

const CAMERA_X = -0.03
const CAMERA_Y = 3.81
const CAMERA_Z = 13.79
const ORBIT_TARGET_X = -0.2
const ORBIT_TARGET_Y = 1.89
const ORBIT_TARGET_Z = -0.08
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 200
const FRUSTUM_HEIGHT = 20
const WHITE = 0xffffff
const AMBIENT_INTENSITY = 0.2
const DIR_LIGHT_INTENSITY = 0.3
const DIR_LIGHT_POS = 5
const TARGET_WIDTH = 8
const TEXT_DEPTH = 0.8
const GAP = 1.4
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
const WALL_DEPTH = 0.3
const WALL_Z = -2
const WALL_SIZE_MULTIPLIER = 10
const WAVE_PLANE_Z = -3.5
const WAVE_PLANE_SIZE = 80
const WAVE_AMPLITUDE_MAX = 1.0
const WAVE_LERP_SPEED = 0.05
const BACKGROUND_COLOR = 0x1c1814
const WAVE_PLANE_COLOR = 0x2e2318
const GRAIN_TEXTURE_SIZE = 256
const GRAIN_WORLD_DENSITY = 1.5
const GRAIN_MIN = 90
const GRAIN_MAX = 255
const BACKGROUND_GRAIN_STRENGTH = 0.04

const WAVE_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const WAVE_FRAGMENT_SHADER = `
  uniform float uGrainTime;
  uniform float uGrainStrength;
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float grain = (hash(gl_FragCoord.xy + uGrainTime) - 0.5) * uGrainStrength;
    vec3 col = uColor + grain;
    gl_FragColor = vec4(col, 1.0);
  }
`

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
  dirLight.position.set(DIR_LIGHT_POS, DIR_LIGHT_POS * 2, DIR_LIGHT_POS)
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

interface WaveState {
  targetAmplitude: number
  currentAmplitude: number
  grainTime: number
}

interface WavePlane {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
}

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

const createWavePlane = (scene: THREE.Scene): WavePlane => {
  const geometry = new THREE.PlaneGeometry(WAVE_PLANE_SIZE, WAVE_PLANE_SIZE)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uGrainTime: { value: 0 },
      uGrainStrength: { value: BACKGROUND_GRAIN_STRENGTH },
      uColor: { value: new THREE.Color(WAVE_PLANE_COLOR) }
    },
    vertexShader: WAVE_VERTEX_SHADER,
    fragmentShader: WAVE_FRAGMENT_SHADER
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, FRUSTUM_HEIGHT / 2, WAVE_PLANE_Z)
  scene.add(mesh)
  return { mesh, material }
}

const loadLogo = async (
  scene: THREE.Scene,
  world: PhysicsWorld,
  bodies: PhysicsBodies,
  material: THREE.Material
): Promise<void> => {
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
  const size = box.getSize(new THREE.Vector3())
  model.scale.setScalar(TARGET_WIDTH / size.x)

  box.setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const scaledSize = box.getSize(new THREE.Vector3())
  const logoPos = new THREE.Vector3(-center.x, -center.y + scaledSize.y / 2 + GAP, -center.z)
  model.position.copy(logoPos)
  model.updateMatrixWorld(true)

  model.traverse((child) => {
    const childMesh = child as THREE.Mesh
    if (childMesh.isMesh) {
      childMesh.material = material
      childMesh.castShadow = true
      applyTriplanarGrainUVs(childMesh)
    }
  })

  const logoBody = model.userData.body as PhysicsBody
  logoBody.setTranslation({ x: logoPos.x, y: logoPos.y, z: logoPos.z }, true)
  bodies.set(model, { body: logoBody, originalPos: logoPos.clone() })
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

const loadText = (
  scene: THREE.Scene,
  world: PhysicsWorld,
  bodies: PhysicsBodies,
  material: THREE.Material,
  font: Font
): void => {
  const referenceGeometry = new TextGeometry('CNOTV', buildTextOptions(font))
  referenceGeometry.computeBoundingBox()
  const fullWidth = referenceGeometry.boundingBox!.max.x - referenceGeometry.boundingBox!.min.x
  referenceGeometry.dispose()
  const baseTextScale = TARGET_WIDTH / fullWidth

  const letters = ['C', 'N', 'O', 'T', 'V']
  const letterGeometries = letters.map((letter) => {
    const geometry = new TextGeometry(letter, buildTextOptions(font))
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
    mesh.position.set(currentX - scaledMinX, -(scaledHeight / 2), 0)
    mesh.castShadow = true
    scene.add(mesh)

    currentX += scaledWidth + (i < letters.length - 1 ? getSpacingAfter(i) : 0)

    return { mesh, scaledWidth, scaledHeight, scaledDepth }
  })

  const centerX = currentX / 2
  meshes.forEach(({ mesh, scaledWidth, scaledHeight, scaledDepth }) => {
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
    bodies.set(mesh, {
      body: rigidBody as PhysicsBody,
      originalPos: mesh.position.clone()
    })
  })
}

const getAncestors = (object: THREE.Object3D): THREE.Object3D[] =>
  object.parent ? [object, ...getAncestors(object.parent)] : [object]

const findBodyForObject = (object: THREE.Object3D, bodies: PhysicsBodies): PhysicsBody | null =>
  getAncestors(object).reduce<PhysicsBody | null>(
    (found, ancestor) => found ?? bodies.get(ancestor)?.body ?? null,
    null
  )

type PhysicsConfig = { impulse: number; torque: number }

const physicsConfigSchema = {
  impulse: { label: 'Movement Speed', min: 0, max: 500, step: 1 },
  torque: { label: 'Rotation Speed', min: 0, max: 100, step: 0.5 }
}

const createClickHandler =
  (
    camera: THREE.OrthographicCamera,
    bodies: PhysicsBodies,
    config: { value: PhysicsConfig },
    onInteract: () => void
  ) =>
  (event: PointerEvent): void => {
    const pointer = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pointer, camera)

    const targets = [...bodies.keys()].flatMap((object) =>
      object instanceof THREE.Group ? [...object.children] : [object]
    )
    const hits = raycaster.intersectObjects(targets, true)
    if (hits.length === 0) return

    const hit = hits[0]
    const body = findBodyForObject(hit.object, bodies)
    if (!body) return

    onInteract()

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
  wallsGroup: THREE.Group
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
  wallsGroup,
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

  const elementStore = useElementPropertiesStore()
  elementStore.registerElementProperties('walls', {
    title: 'Walls',
    schema: {
      position: {
        label: 'Position',
        x: { label: 'X', min: -20, max: 20, step: 0.1 },
        y: { label: 'Y', min: -20, max: 20, step: 0.1 },
        z: { label: 'Z', min: -20, max: 20, step: 0.1 }
      }
    },
    getValue: (path) => {
      if (path === 'position')
        return {
          x: wallsGroup.position.x,
          y: wallsGroup.position.y,
          z: wallsGroup.position.z
        }
      return undefined
    },
    updateValue: (path, value) => {
      if (path === 'position') {
        const pos = value as { x: number; y: number; z: number }
        wallsGroup.position.set(pos.x, pos.y, pos.z)
      }
    }
  })
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
    color: 0xdddddd,
    roughness: 0.5,
    metalness: 0.6,
    map: grainTexture,
    roughnessMap: grainTexture
  })

  const bodies: PhysicsBodies = new Map()
  await loadLogo(scene, world, bodies, contentMaterial)

  new FontLoader().load(helvetikerBoldUrl, (font) => {
    loadText(scene, world, bodies, contentMaterial, font)
  })

  const wallAspect = window.innerWidth / window.innerHeight
  const wallLength = Math.ceil(FRUSTUM_HEIGHT * wallAspect)
  const wallsGroup = getWalls(scene, world, {
    length: wallLength * WALL_SIZE_MULTIPLIER,
    height: FRUSTUM_HEIGHT * WALL_SIZE_MULTIPLIER,
    depth: WALL_DEPTH
  })
  wallsGroup.rotation.x = Math.PI / 2
  wallsGroup.position.z = WALL_Z
  wallsGroup.visible = false

  const wavePlane = createWavePlane(scene)
  const waveState: WaveState = {
    targetAmplitude: 0,
    currentAmplitude: 0,
    grainTime: 0
  }
  const startWave = (): void => {
    waveState.targetAmplitude = WAVE_AMPLITUDE_MAX
  }

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
  registerPanels({ camera, orbit, ambientLight, dirLight, wallsGroup, contentMaterial })

  const timelineManager = createResetTimeline(bodies)

  const onResize = createResizeHandler(camera, renderer)
  const onPointerDown = createClickHandler(camera, bodies, physicsConfig, startWave)
  window.addEventListener('resize', onResize)
  canvasElement.addEventListener('pointerdown', onPointerDown)

  const clock = new THREE.Clock()
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

    bodies.forEach(({ body }, mesh) => {
      const pos = body.translation()
      const rot = body.rotation()
      mesh.position.set(pos.x, pos.y, pos.z)
      mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    })

    waveState.currentAmplitude +=
      (waveState.targetAmplitude - waveState.currentAmplitude) * WAVE_LERP_SPEED
    const grainActivation = waveState.currentAmplitude / WAVE_AMPLITUDE_MAX
    waveState.grainTime += delta * grainActivation
    wavePlane.material.uniforms.uGrainTime.value = waveState.grainTime
    wavePlane.material.uniforms.uGrainStrength.value =
      BACKGROUND_GRAIN_STRENGTH * (1 + grainActivation)

    renderer.render(scene, camera)
  }
  runAnimation()
  loadingVisible.value = false

  cleanupReference = () => {
    window.removeEventListener('resize', onResize)
    canvasElement.removeEventListener('pointerdown', onPointerDown)
    grainTexture.dispose()
    contentMaterial.dispose()
    wavePlane.material.dispose()
    wavePlane.mesh.geometry.dispose()
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
  <canvas ref="canvas" class="landing-page__canvas" />
  <div class="landing-page__frame">
    <div class="landing-page__corner landing-page__corner--tl" />
    <div class="landing-page__corner landing-page__corner--tr" />
    <div class="landing-page__corner landing-page__corner--bl" />
    <div class="landing-page__corner landing-page__corner--br" />
    <span class="landing-page__label landing-page__label--top">Generative playground</span>
    <span class="landing-page__label landing-page__label--bottom">2026</span>
    <span class="landing-page__flyer landing-page__flyer--tagline">
      Generative and Game Development
    </span>
    <span class="landing-page__flyer landing-page__flyer--left">UI · K8S</span>
    <span class="landing-page__flyer landing-page__flyer--right"> Web · Three.js · Physics </span>
    <span class="landing-page__flyer landing-page__flyer--sub"> Click the logo or letters </span>
  </div>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>

<style scoped>
.landing-page__canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: fixed;
  inset: 0;
  background-color: var(--color-paper-dark);
  z-index: calc(var(--z-base) + 0);
}

.landing-page__frame {
  position: fixed;
  inset: var(--spacing-8);
  pointer-events: none;
  z-index: calc(var(--z-base) + 1);
}

.landing-page__corner {
  position: absolute;
  width: 14px;
  height: 14px;
}

.landing-page__corner--tl {
  top: 0;
  left: 0;
  border-top: 1px solid rgb(255, 255, 255, 0.22);
  border-left: 1px solid rgb(255, 255, 255, 0.22);
}

.landing-page__corner--tr {
  top: 0;
  right: 0;
  border-top: 1px solid rgb(255, 255, 255, 0.22);
  border-right: 1px solid rgb(255, 255, 255, 0.22);
}

.landing-page__corner--bl {
  bottom: 0;
  left: 0;
  border-bottom: 1px solid rgb(255, 255, 255, 0.22);
  border-left: 1px solid rgb(255, 255, 255, 0.22);
}

.landing-page__corner--br {
  bottom: 0;
  right: 0;
  border-bottom: 1px solid rgb(255, 255, 255, 0.22);
  border-right: 1px solid rgb(255, 255, 255, 0.22);
}

.landing-page__label {
  position: absolute;
  font-size: var(--font-size-2xs);
  letter-spacing: 0.18em;
  color: rgb(255, 255, 255, 0.18);
  font-family: var(--font-mono);
  text-transform: uppercase;
}

.landing-page__label--top {
  top: var(--spacing-2);
  left: var(--spacing-4);
}

.landing-page__label--bottom {
  bottom: var(--spacing-2);
  right: var(--spacing-4);
}

.landing-page__flyer {
  position: absolute;
  font-family: var(--font-mono);
  color: rgb(255, 255, 255, 0.13);
  text-transform: uppercase;
  white-space: nowrap;
}

.landing-page__flyer--tagline {
  bottom: var(--spacing-8);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-xs);
  letter-spacing: 0.22em;
  color: rgb(255, 255, 255, 0.16);
}

.landing-page__flyer--left {
  left: var(--spacing-2);
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.3em;
}

.landing-page__flyer--right {
  right: var(--spacing-2);
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.2em;
}

.landing-page__flyer--sub {
  bottom: var(--spacing-4);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-2xs);
  letter-spacing: 0.35em;
  color: rgb(255, 255, 255, 0.08);
}
</style>
