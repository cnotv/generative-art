import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import RAPIER from '@dimforge/rapier3d-compat'
import { EffectComposer, setupPostprocessing } from './postprocessing'
import { video } from './utils/video'
import { animateTimeline, CoordinateTuple, type TimelineManager } from '@webgamekit/animation'
import {
  ToolsConfig,
  SetupConfig,
  ModelOptions,
  ComplexModel,
  LightsConfig,
  GroundConfig,
  CameraConfig,
  OnProgress
} from './types'
import { getEnvironment, getLights, getGround, getSky } from './getters'
import { disposeScene } from './dispose'
import { updateCamera } from './camera'
import { deepMerge } from './utils/lodash'
import { SCENE_DEFAULTS } from './defaults'
import { textureLoader } from './loaders'

/**
 * Merge a partial SetupConfig over SCENE_DEFAULTS so every section has complete values.
 * Sections disabled with `false` are preserved as `false`.
 * Camera is only merged when the caller provides camera config.
 */
export const resolveSetupConfig = (config: SetupConfig): SetupConfig => ({
  ...config,
  lights:
    config.lights === false
      ? false
      : (deepMerge(
          SCENE_DEFAULTS.lights as Record<string, unknown>,
          (config.lights ?? {}) as Record<string, unknown>
        ) as LightsConfig),
  ground:
    config.ground === false
      ? false
      : (deepMerge(
          SCENE_DEFAULTS.ground as Record<string, unknown>,
          (config.ground ?? {}) as Record<string, unknown>
        ) as GroundConfig),
  sky:
    config.sky === false
      ? false
      : (deepMerge(
          SCENE_DEFAULTS.sky as Record<string, unknown>,
          (config.sky ?? {}) as Record<string, unknown>
        ) as SetupConfig['sky']),
  camera: config.camera
    ? (deepMerge(
        SCENE_DEFAULTS.camera as Record<string, unknown>,
        config.camera as Record<string, unknown>
      ) as CameraConfig)
    : config.camera
})

export const defaultModelOptions: ModelOptions = {
  position: [0, 0, 0],
  color: 0x222222,
  mass: 1,
  density: 1,
  weight: 5,
  friction: 0,
  restitution: 0,
  damping: 0,
  opacity: 1,
  reflectivity: 0.5,
  roughness: 1,
  metalness: 0,
  transmission: 0
}

const createOrbitControls = (
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  orbitConfig: Exclude<SetupConfig['orbit'], false>
): OrbitControls => {
  const orbit = new OrbitControls(camera, renderer.domElement)
  if (orbitConfig?.target) {
    orbit.target.copy(orbitConfig.target as THREE.Vector3)
  }
  orbit.enabled = !(orbitConfig?.disabled === true)
  return orbit
}

const applySceneConfig = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  world: RAPIER.World,
  resolved: SetupConfig
) => {
  if (resolved.scene?.backgroundColor)
    scene.background = new THREE.Color(resolved.scene.backgroundColor)
  if (resolved.lights !== false) getLights(scene, resolved.lights)
  const ground = resolved.ground !== false ? getGround(scene, world, resolved.ground ?? {}) : null
  if (resolved.sky !== false) getSky(scene, resolved.sky ?? {})
  if (resolved.camera) updateCamera(camera, resolved.camera)
  return ground
}

/**
 * Initialize ThreeJS and Rapier and retrieve common tools.
 * Add lights, ground, and camera to the scene with default values.
 * Configuration passed through the setup function.
 * Animation allows to define a timeline with looped actions, as well as a before and after function.
 * Stats, configuration and video are handled by other utilities and added by default.
 *
 * Example config for postprocessing shading effects:
 *
 * postprocessing: {
 *   pixelate: { size: 8 },
 *   bloom: { strength: 0.8, threshold: 0.2, radius: 1.0 },
 *   fxaa: {},
 *   dotScreen: { scale: 1.5, angle: Math.PI / 3, center: [0.5, 0.5] },
 *   rgbShift: { amount: 0.002 },
 *   film: { noiseIntensity: 0.5, scanlinesIntensity: 0.05, scanlinesCount: 800, grayscale: true },
 *   glitch: {},
 *   afterimage: {},
 *   ssao: {},
 *   vignette: { offset: 1.2, darkness: 1.3, color: 0x222222 },
 *   colorCorrection: { contrast: 1.2, saturation: 1.1, brightness: 1.0 },
 * }
 *
 * @param {stats, route, canvas}
 * @param options
 * @returns {setup, animate, clock, delta, frame, renderer, scene, camera, orbit, world}
 */
/**
 * The most-recently created WebGLRenderer from getTools().
 * Read by the debug panel to access draw-call and triangle counts without
 * requiring each view to explicitly register its renderer.
 */
export const activeRendererReference: { current: THREE.WebGLRenderer | null } = { current: null }

const emitProgress = (
  callback: OnProgress | undefined,
  stage: string,
  detail?: string,
  done = false
): void => {
  callback?.({ stage, detail, done })
}

const createResizeHandler =
  (renderer: THREE.WebGLRenderer, camera: THREE.Camera): (() => void) =>
  () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    if (camera instanceof THREE.OrthographicCamera) {
      const halfH = camera.top
      const newHalfW = halfH * (window.innerWidth / window.innerHeight)
      camera.left = -newHalfW
      camera.right = newHalfW
    } else {
      ;(camera as THREE.PerspectiveCamera).aspect = window.innerWidth / window.innerHeight
    }
    ;(camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).updateProjectionMatrix()
  }

export const getTools = async ({
  stats,
  route,
  canvas,
  resize = true,
  onProgress
}: ToolsConfig) => {
  const clock = new THREE.Clock()
  let delta = 0
  let simulationFrame = 0
  let frameRate = 1 / 60
  emitProgress(onProgress, 'Physics')
  const { renderer, scene, camera, world } = await getEnvironment(canvas)
  let activeCamera: THREE.Camera = camera
  activeRendererReference.current = renderer
  let composer: EffectComposer | null = null
  let populateOutline: ((sceneReference: THREE.Scene) => void) | null = null
  if (video && route) video.record(canvas, route)
  const getDelta = () => delta
  let orbit: OrbitControls | null = null
  let animationFrameId = 0
  const setup = async ({
    config = {},
    defineSetup
  }: {
    config?: SetupConfig
    defineSetup?: (context: {
      ground: ReturnType<typeof getGround> | null
      orbit: OrbitControls | null
    }) => Promise<void> | void
  }) => {
    const resolved = resolveSetupConfig(config)
    const childrenCountBefore = scene.children.length
    frameRate = resolved?.global?.frameRate || frameRate
    if (resolved.orbit !== false) orbit = createOrbitControls(camera, renderer, resolved.orbit)
    const ground = applySceneConfig(scene, camera, world, resolved)
    if (config.postprocessing) {
      const pp = await setupPostprocessing({
        renderer,
        scene,
        camera,
        config: config.postprocessing
      })
      if (pp) {
        composer = pp.composer
        populateOutline = pp.populateOutline
      }
    }
    if (defineSetup) await defineSetup({ ground, orbit })
    if (populateOutline) populateOutline(scene)
    emitProgress(onProgress, 'Ready', undefined, true)
    const elements = scene.children.slice(childrenCountBefore)
    return { orbit, ground, elements }
  }
  const animate = ({
    beforeTimeline = () => {},
    afterTimeline = () => {},
    timeline,
    isPaused = () => false,
    config = {
      orbit: {
        debug: false
      }
    }
  }: {
    beforeTimeline?: () => void
    afterTimeline?: () => void
    timeline: TimelineManager
    isPaused?: () => boolean
    config?: {
      orbit?: {
        debug?: boolean
      }
    }
  }) => {
    let accumulator = 0
    const renderFrame = () => {
      if (composer) composer.render()
      else renderer.render(scene, activeCamera)
    }
    const updateOrbitAndRender = () => {
      if (orbit) orbit.update()
      if (orbit && config.orbit?.debug) console.warn(activeCamera)
      renderFrame()
    }
    const tickSimulation = () => {
      world.step()
      beforeTimeline()
      animateTimeline(timeline, simulationFrame, undefined, { enableAutoRemoval: true })
      afterTimeline()
      updateOrbitAndRender()
      if (video?.stop && route) video.stop(renderer.info.render.frame, route)
    }
    function runAnimation() {
      if (stats?.start && route) stats.start(route.name ?? '')
      delta = clock.getDelta()
      animationFrameId = requestAnimationFrame(runAnimation)
      if (isPaused()) {
        updateOrbitAndRender()
        return
      }
      accumulator += delta
      if (accumulator < frameRate) return
      accumulator -= frameRate
      simulationFrame += 1
      tickSimulation()
      if (stats?.end && route) stats.end(route.name ?? '')
    }
    runAnimation()
  }

  let handleResize = createResizeHandler(renderer, activeCamera)

  if (resize !== false) window.addEventListener('resize', handleResize)

  const setActiveCamera = (newCamera: THREE.Camera): OrbitControls | null => {
    activeCamera = newCamera
    if (resize !== false) window.removeEventListener('resize', handleResize)
    handleResize = createResizeHandler(renderer, newCamera)
    if (resize !== false) window.addEventListener('resize', handleResize)
    if (orbit) {
      orbit.object = newCamera as THREE.PerspectiveCamera
      orbit.update()
    }
    return orbit
  }

  const cleanup = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    if (resize !== false) window.removeEventListener('resize', handleResize)
    disposeScene(renderer)
    activeRendererReference.current = null
  }

  return {
    setup,
    animate,
    clock,
    getDelta,
    getSimulationFrame: () => simulationFrame,
    getFrameRate: () => frameRate,
    renderer,
    scene,
    camera,
    orbit,
    world,
    cleanup,
    setActiveCamera
  }
}

/**
 * Remove elements from the threeJS scene and Rapier world, then return the emptied list
 * @param world
 * @param elements
 * @returns
 */
export const removeElements = (world: RAPIER.World, meshes: ComplexModel[]) => {
  meshes.forEach((mesh) => {
    mesh.removeFromParent()
    if (mesh.userData.helper) (mesh.userData.helper as THREE.Object3D).removeFromParent()
    if (mesh.userData.body) {
      world.removeRigidBody(mesh.userData.body)
    }
  })

  return []
}

export const onWindowResize = (camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix()
  }
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// https://threejs.org/docs/#api/en/objects/InstancedMesh
/**
 * Create multiple instances of a given mesh, based on a configuration
 * @param mesh
 * @param scene
 * @param options
 * @returns
 */
export const instanceMatrixMesh = (
  mesh: THREE.Mesh,
  scene: THREE.Scene,
  options: ModelOptions[]
): THREE.InstancedMesh[] => {
  const count = options.length
  const geometry = mesh.geometry
  const material = mesh.material
  const instancedMesh = new THREE.InstancedMesh(geometry, material, count)
  instancedMesh.receiveShadow = true

  return options.map(({ position, rotation, scale, textures }, index) => {
    const matrix = new THREE.Matrix4()
    const positionVector = new THREE.Vector3(...(position ?? [0, 0, 0]))
    const rotationEuler = new THREE.Euler(...(rotation ?? [0, 0, 0]))
    const scaleVector = new THREE.Vector3(...(scale ?? [1, 1, 1]))

    matrix.compose(positionVector, new THREE.Quaternion().setFromEuler(rotationEuler), scaleVector)
    instancedMesh.setMatrixAt(index, matrix)
    if (textures) {
      const counter = textures.random
        ? Math.floor(Math.random() * textures.list.length)
        : index % textures.list.length
      const loadedTexture = textureLoader.load(textures.list[counter])
      ;(mesh.material as THREE.MeshStandardMaterial).map = loadedTexture
    }

    scene.add(instancedMesh)

    return instancedMesh
  })
}

/**
 * Generate multiple instances for a model based on a configuration
 * @param model
 * @param scene
 * @param options
 */
export const instanceMatrixModel = (
  model: THREE.Group<THREE.Object3DEventMap>,
  scene: THREE.Scene,
  options: ModelOptions[]
): void => {
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      instanceMatrixMesh(child as THREE.Mesh, scene, options)
    }
  })
}

/**
 * Compute the position offset for an origin specification, e.g. so a cube's
 * `position` represents a corner/edge instead of its center
 * @param size The size [x, y, z] of the geometry
 * @param origin The origin point specification { x?, y?, z? }
 * @returns The [x, y, z] offset to add to a center-based position, zero on axes where origin is not set
 */
export const getOriginOffset = (
  size: CoordinateTuple,
  origin?: { x?: number; y?: number; z?: number }
): CoordinateTuple => [
  origin?.x !== undefined ? size[0] / 2 : 0,
  origin?.y !== undefined ? size[1] / 2 : 0,
  origin?.z !== undefined ? size[2] / 2 : 0
]
