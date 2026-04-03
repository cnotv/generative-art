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
  CameraConfig
} from './types'
import { getEnvironment, getLights, getGround, getSky } from './getters'
import { updateCamera } from './camera'
import { deepMerge } from './utils/lodash'
import { SCENE_DEFAULTS } from './defaults'

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
export const getTools = async ({ stats, route, canvas, resize = true }: ToolsConfig) => {
  const clock = new THREE.Clock()
  let delta = 0
  let simulationFrame = 0
  let frameRate = 1 / 60
  const { renderer, scene, camera, world } = await getEnvironment(canvas)
  let composer: EffectComposer | null = null
  if (video && route) video.record(canvas, route)
  const getDelta = () => delta
  let orbit: OrbitControls | null = null

  /**
   * Setup scene
   * @param config Configuration for camera, ground and lights
   * @param defineSetup Actions required to be performed before the animation loop
   */
  const setup = async ({
    config = {},
    defineSetup
  }: {
    config?: SetupConfig
    defineSetup?: (context: { ground: ReturnType<typeof getGround> | null }) => Promise<void> | void
  }) => {
    const resolved = resolveSetupConfig(config)
    const childrenCountBefore = scene.children.length
    frameRate = resolved?.global?.frameRate || frameRate
    if (resolved.orbit !== false) orbit = createOrbitControls(camera, renderer, resolved.orbit)
    const ground = applySceneConfig(scene, camera, world, resolved)
    if (config.postprocessing)
      composer = await setupPostprocessing({
        renderer,
        scene,
        camera,
        config: config.postprocessing
      })
    if (defineSetup) await defineSetup({ ground })
    const elements = scene.children.slice(childrenCountBefore)
    return { orbit, ground, elements }
  }

  /**
   * The animation loop.
   * @param beforeTimeline Actions required to be performed before the timeline
   * @param afterTimeline Actions required to be performed after the timeline
   * @param timeline TimelineManager instance for managing animations
   */
  const animate = ({
    beforeTimeline = () => {},
    afterTimeline = () => {},
    timeline,
    config = {
      orbit: {
        debug: false
      }
    }
  }: {
    beforeTimeline?: () => void
    afterTimeline?: () => void
    timeline: TimelineManager
    config?: {
      orbit?: {
        debug?: boolean
      }
    }
  }) => {
    let accumulator = 0

    const renderFrame = () => {
      if (composer) composer.render()
      else renderer.render(scene, camera)
    }

    const tickSimulation = () => {
      world.step()
      beforeTimeline()
      animateTimeline(timeline, simulationFrame, undefined, { enableAutoRemoval: true })
      afterTimeline()
      if (orbit) {
        orbit.update()
        if (config.orbit?.debug) console.warn(camera)
      }
      renderFrame()
      if (video?.stop && route) video.stop(renderer.info.render.frame, route)
    }

    function runAnimation() {
      if (stats?.start && route) stats.start(route.name ?? '')
      delta = clock.getDelta()
      requestAnimationFrame(runAnimation)

      accumulator += delta
      if (accumulator < frameRate) return
      accumulator -= frameRate
      simulationFrame += 1

      tickSimulation()
      if (stats?.end && route) stats.end(route.name ?? '')
    }
    runAnimation()
  }

  const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    if (camera instanceof THREE.OrthographicCamera) {
      const halfH = camera.top
      const newHalfW = halfH * (window.innerWidth / window.innerHeight)
      camera.left = -newHalfW
      camera.right = newHalfW
    } else {
      ;(camera as THREE.PerspectiveCamera).aspect = window.innerWidth / window.innerHeight
    }
    camera.updateProjectionMatrix()
  }

  if (resize !== false) {
    window.addEventListener('resize', handleResize)
  }

  const cleanup = () => {
    if (resize !== false) window.removeEventListener('resize', handleResize)
  }

  return {
    setup,
    animate,
    clock,
    getDelta,
    renderer,
    scene,
    camera,
    orbit,
    world,
    cleanup
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
      const textureLoader = new THREE.TextureLoader()
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
 * Apply origin-based translation to geometry
 * Translates geometry so specified edges align with the origin coordinates
 * @param geometry The geometry to translate
 * @param size The size [x, y, z] of the geometry
 * @param origin The origin point specification { x?, y?, z? }
 */
export const applyOriginTranslation = (
  geometry: THREE.BufferGeometry,
  size: CoordinateTuple,
  origin?: { x?: number; y?: number; z?: number }
): void => {
  if (!origin) return

  const translateX = origin.x !== undefined ? size[0] / 2 : 0
  const translateY = origin.y !== undefined ? size[1] / 2 : 0
  const translateZ = origin.z !== undefined ? size[2] / 2 : 0

  if (translateX !== 0 || translateY !== 0 || translateZ !== 0) {
    geometry.translate(translateX, translateY, translateZ)
  }
}
