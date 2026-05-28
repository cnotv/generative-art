import cloudUrl from '@/assets/images/goomba/cloud.png'
import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  getTools,
  getBall,
  getCube,
  moveDynamic,
  generateAreaPositions,
  type ComplexModel
} from '@webgamekit/threejs'
import {
  createCameraFollowAction,
  createDirectionalLightFollowAction,
  createPhysicsSyncAction,
  createTimerAction,
  createFallCheckAction
} from '@/utils/gameTimelineActions'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents } from '@webgamekit/controls'
import { createTimelineManager, type CoordinateTuple } from '@webgamekit/animation'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { registerTextureAreaProperties } from '@/utils/textureAreaProperties'
import { registerObjectProperties } from '@/utils/objectProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import {
  MARBLE_RADIUS,
  MARBLE_WEIGHT,
  MARBLE_RESTITUTION,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MOVE_FORCE,
  MAX_LINEAR_SPEED,
  CAMERA_HEIGHT,
  CAMERA_BACK,
  FALL_THRESHOLD_Y,
  TIME_PENALTY_FALL,
  POS_BROADCAST_MS,
  OBSTACLE_COLOR,
  KEYBOARD_MAPPING,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  CLOUD_AREA_NAME,
  CLOUD_AREA_SEED,
  CLOUD_AREA_CONTROLS,
  LIGHT_SHADOW_RADIUS,
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA,
  type TrackConfig
} from './config'
import type { GameDeps, BallPosPayload } from './types'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type SceneContext = Omit<
  Pick<GetToolsResult, 'scene' | 'world' | 'camera' | 'getDelta' | 'animate' | 'orbit'>,
  'orbit'
> & {
  orbit: OrbitControls | null
}

type Vec3 = { x: number; y: number; z: number }

type MarbleState = {
  marbleMesh: ComplexModel | null
  groundSphereMesh: THREE.Mesh | null
  controls: ControlsExtras | null
  posAccumulator: number
  finished: Ref<boolean>
  elapsed: Ref<number>
  penaltyCount: Ref<number>
  directionalLight: THREE.DirectionalLight | null
}

const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_HEIGHT, CAMERA_BACK]
const PLATFORM_HALF_HEIGHT = 0.5
const CLOUD_Y = -100
const CLOUD_AREA_CENTER_Z = 50
const CLOUD_ROTATION: CoordinateTuple = [Math.PI / 2, 0, 0]
const CLOUD_AREA_WIDTH = 600
const CLOUD_AREA_DEPTH = 1400
const CLOUD_BASE_WIDTH = 145
const CLOUD_BASE_HEIGHT = 0.001
const CLOUD_BASE_DEPTH = 60
const CLOUD_DENSITY = 30
const CLOUD_AREA_CENTER: CoordinateTuple = [0, CLOUD_Y, CLOUD_AREA_CENTER_Z]
const CLOUD_AREA_SIZE: CoordinateTuple = [CLOUD_AREA_WIDTH, 0, CLOUD_AREA_DEPTH]
const CLOUD_BASE_SIZE: CoordinateTuple = [CLOUD_BASE_WIDTH, CLOUD_BASE_HEIGHT, CLOUD_BASE_DEPTH]

const GROUND_SPHERE_RADIUS = 600
const GROUND_SPHERE_Y = -700
const GROUND_SPHERE_Z = -120
const GROUND_SPHERE_CENTER: CoordinateTuple = [0, GROUND_SPHERE_Y, GROUND_SPHERE_Z]
const GROUND_SPHERE_COLOR = 0x4a7a3a

type CloudBuildOptions = {
  center: CoordinateTuple
  size: CoordinateTuple
  baseSize: CoordinateTuple
  rotation: CoordinateTuple
  sizeVariation: CoordinateTuple
  rotationVariation: CoordinateTuple
  pattern: 'random' | 'grid' | 'grid-jitter'
  count: number
  seed: number
  opacity: number
}

const HALF = 0.5
const applyVariation = (base: number, variation: number): number =>
  base + (Math.random() - HALF) * 2 * variation

const buildCloudObjects = (
  scene: THREE.Scene,
  world: NonNullable<GetToolsResult['world']>,
  options: CloudBuildOptions
): ComplexModel[] => {
  const {
    center,
    size,
    baseSize,
    rotation,
    sizeVariation,
    rotationVariation,
    pattern,
    count,
    seed,
    opacity
  } = options
  const positions = generateAreaPositions({ center, size, count, pattern, seed })
  return positions.map((position) => {
    const instanceSize: CoordinateTuple = [
      Math.max(1, applyVariation(baseSize[0], sizeVariation[0])),
      baseSize[1],
      Math.max(1, applyVariation(baseSize[2], sizeVariation[2]))
    ]
    const instanceRotation: CoordinateTuple = [
      rotation[0] + applyVariation(0, rotationVariation[0]),
      rotation[1] + applyVariation(0, rotationVariation[1]),
      rotation[2] + applyVariation(0, rotationVariation[2])
    ]
    return getCube(scene, world, {
      size: instanceSize,
      position,
      rotation: instanceRotation,
      texture: cloudUrl,
      material: 'MeshBasicMaterial',
      transparent: true,
      opacity,
      alphaTest: 0.1,
      type: 'fixed',
      castShadow: false,
      receiveShadow: false
    })
  })
}

const disposeClouds = (
  objects: ComplexModel[],
  scene: THREE.Scene | null,
  world: NonNullable<GetToolsResult['world']> | null
): void => {
  objects.forEach((cloudObject) => {
    const mesh = cloudObject as unknown as THREE.Mesh
    scene?.remove(cloudObject)
    mesh.geometry.dispose()
    if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    world?.removeRigidBody(cloudObject.userData.body)
  })
}

const applyDamping = (model: ComplexModel): void => {
  model.userData.body.setLinearDamping(MARBLE_LINEAR_DAMPING)
  model.userData.body.setAngularDamping(MARBLE_ANGULAR_DAMPING)
}

const respawn = (model: ComplexModel, spawnPosition: CoordinateTuple): void => {
  model.userData.body.setTranslation(
    { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] },
    true
  )
  model.userData.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  model.userData.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

const computeImpulse = (currentActions: ControlsCurrents): Vec3 => {
  const x =
    ('left' in currentActions ? -MOVE_FORCE : 0) + ('right' in currentActions ? MOVE_FORCE : 0)
  const z =
    ('forward' in currentActions ? -MOVE_FORCE : 0) +
    ('backward' in currentActions ? MOVE_FORCE : 0)
  return { x, y: 0, z }
}

const isInFinishZone = (pos: THREE.Vector3, track: TrackConfig): boolean => {
  if (pos.z >= track.finishCheckZ) return false
  const dx = pos.x - track.finishPosition[0]
  const dz = pos.z - track.finishPosition[2]
  return Math.hypot(dx, dz) < track.finishCheckRadius
}

const buildCourse = (
  scene: THREE.Scene,
  world: NonNullable<GetToolsResult['world']>,
  track: TrackConfig
): void => {
  track.platforms.forEach(({ size, position, color, rotation }) => {
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      rotation: rotation as CoordinateTuple | undefined,
      type: 'fixed',
      color,
      restitution: 0.2,
      friction: 0.9
    })
  })
  track.obstacles.forEach(({ size, position }) => {
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      type: 'fixed',
      color: OBSTACLE_COLOR,
      restitution: 0.1,
      friction: 0.5
    })
  })
}

const makeGhostMarble = (scene: THREE.Scene, colorHex: number, texture?: string): THREE.Mesh =>
  getBall(scene, undefined, {
    size: MARBLE_RADIUS,
    color: colorHex,
    texture,
    transparent: true,
    opacity: 0.7,
    segments: 16
  })

const buildTimeline = (
  camera: THREE.Camera,
  getDelta: () => number,
  state: MarbleState,
  deps: GameDeps,
  orbit: OrbitControls | null
) => {
  const timeline = createTimelineManager()

  timeline.addAction({
    name: 'marble-input',
    category: 'physics',
    start: 0,
    action: () => {
      if (!state.marbleMesh || state.finished.value || !state.controls) return
      const impulse = computeImpulse(state.controls.currentActions)
      if (impulse.x !== 0 || impulse.z !== 0) {
        moveDynamic(state.marbleMesh, impulse, MAX_LINEAR_SPEED)
      }
    }
  })

  timeline.addAction(createPhysicsSyncAction(() => state.marbleMesh, PLATFORM_HALF_HEIGHT))
  timeline.addAction(
    createDirectionalLightFollowAction(
      () => state.directionalLight,
      () => state.marbleMesh,
      LIGHT_DIRECTIONAL_POSITION as CoordinateTuple
    )
  )
  timeline.addAction(
    createCameraFollowAction(
      camera,
      () => state.marbleMesh,
      CAMERA_OFFSET,
      () => orbit
    )
  )

  timeline.addAction(
    createFallCheckAction(
      () => state.marbleMesh,
      FALL_THRESHOLD_Y,
      () => {
        state.elapsed.value += TIME_PENALTY_FALL
        state.penaltyCount.value += 1
        if (state.marbleMesh) respawn(state.marbleMesh, deps.track.value.spawnPosition)
      }
    )
  )

  timeline.addAction({
    name: 'finish-check',
    category: 'game',
    start: 0,
    action: () => {
      if (!state.marbleMesh || state.finished.value) return
      if (isInFinishZone(state.marbleMesh.position, deps.track.value)) {
        state.finished.value = true
        deps.onWin()
      }
    }
  })

  timeline.addAction({
    name: 'pos-broadcast',
    category: 'network',
    start: 0,
    action: () => {
      if (deps.isSolo.value || !state.marbleMesh) return
      state.posAccumulator += getDelta() * 1000
      if (state.posAccumulator >= POS_BROADCAST_MS) {
        const pos = state.marbleMesh.userData.body.translation()
        deps.onPositionUpdate({ x: pos.x, y: pos.y, z: pos.z })
        state.posAccumulator = 0
      }
    }
  })

  timeline.addAction(createTimerAction(state.elapsed, () => state.finished.value, getDelta))

  return timeline
}

type CloudAreaRebuildCallback = (options: CloudBuildOptions) => void

const setupCloudArea = (
  scene: THREE.Scene,
  world: NonNullable<GetToolsResult['world']>,
  areaConfigs: Ref<Record<string, Record<string, unknown>>>,
  onRebuild: CloudAreaRebuildCallback
): ComplexModel[] => {
  const NO_VARIATION: CoordinateTuple = [0, 0, 0]
  const initialObjects = buildCloudObjects(scene, world, {
    center: CLOUD_AREA_CENTER,
    size: CLOUD_AREA_SIZE,
    baseSize: CLOUD_BASE_SIZE,
    rotation: CLOUD_ROTATION,
    sizeVariation: NO_VARIATION,
    rotationVariation: NO_VARIATION,
    pattern: 'grid-jitter',
    count: CLOUD_DENSITY,
    seed: CLOUD_AREA_SEED,
    opacity: 1
  })
  registerTextureAreaProperties({
    areaName: CLOUD_AREA_NAME,
    layers: [
      {
        name: CLOUD_AREA_NAME,
        texture: cloudUrl,
        baseSize: CLOUD_BASE_SIZE,
        center: CLOUD_AREA_CENTER,
        size: CLOUD_AREA_SIZE,
        density: CLOUD_DENSITY,
        seed: CLOUD_AREA_SEED,
        speed: 0,
        opacity: 1
      }
    ],
    schema: CLOUD_AREA_CONTROLS,
    areaConfigs,
    onUpdate: (name) => {
      const config = areaConfigs.value[name]
      if (!config) return
      const area = config.area as {
        center: { x: number; y: number; z: number }
        size: { x: number; y: number; z: number }
      }
      const textures = config.textures as {
        baseSize: { x: number; y: number; z: number }
        sizeVariation: { x: number; y: number; z: number }
        rotationVariation: { x: number; y: number; z: number }
      }
      const instances = config.instances as {
        density: number
        pattern: 'random' | 'grid' | 'grid-jitter'
        seed: number
      }
      const rendering = config.rendering as { opacity: number }
      onRebuild({
        center: [area.center.x, area.center.y, area.center.z],
        size: [area.size.x, area.size.y, area.size.z],
        baseSize: [textures.baseSize.x, textures.baseSize.y, textures.baseSize.z],
        rotation: CLOUD_ROTATION,
        sizeVariation: [
          textures.sizeVariation.x,
          textures.sizeVariation.y,
          textures.sizeVariation.z
        ],
        rotationVariation: [
          textures.rotationVariation.x,
          textures.rotationVariation.y,
          textures.rotationVariation.z
        ],
        pattern: instances.pattern,
        count: instances.density,
        seed: instances.seed,
        opacity: rendering.opacity
      })
    }
  })
  return initialObjects
}

const buildSceneSetupConfig = (track: TrackConfig) => ({
  camera: {
    position: [
      track.spawnPosition[0],
      track.spawnPosition[1] + CAMERA_HEIGHT,
      track.spawnPosition[2] + CAMERA_BACK
    ] as CoordinateTuple
  },
  orbit: { disabled: true },
  ground: false as const,
  sky: false as const,
  lights: {
    ambient: { intensity: LIGHT_AMBIENT_INTENSITY },
    directional: {
      intensity: LIGHT_DIRECTIONAL_INTENSITY,
      position: LIGHT_DIRECTIONAL_POSITION as CoordinateTuple,
      shadow: { radius: LIGHT_SHADOW_RADIUS, bias: LIGHT_SHADOW_BIAS, camera: LIGHT_SHADOW_CAMERA }
    }
  }
})

/**
 * Set up and manage the MarbleMadness Three.js scene, physics, and game loop.
 * @param deps - Canvas ref, solo flag, track config, win/position callbacks.
 * @returns Controls to init, destroy, update ghost positions, and reactive elapsed time.
 */
export const useMarbleMadnessGame = (deps: GameDeps) => {
  const state: MarbleState = {
    marbleMesh: null,
    groundSphereMesh: null,
    controls: null,
    posAccumulator: 0,
    finished: ref(false),
    elapsed: ref(0),
    penaltyCount: ref(0),
    directionalLight: null
  }
  let cleanupTools: (() => void) | null = null
  const ghostMeshes = new Map<string, THREE.Mesh>()
  let sceneReference: THREE.Scene | null = null
  let worldReference: NonNullable<GetToolsResult['world']> | null = null
  let cloudObjects: ComplexModel[] = []
  const areaConfigs = ref<Record<string, Record<string, unknown>>>({})

  const buildGame = async ({ scene, world, camera, getDelta, animate, orbit }: SceneContext) => {
    if (!world) return
    sceneReference = scene
    worldReference = world
    state.directionalLight =
      (scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight) ??
      null
    const track = deps.track.value
    cloudObjects = setupCloudArea(scene, world, areaConfigs, (options) => {
      if (!sceneReference || !worldReference) return
      disposeClouds(cloudObjects, sceneReference, worldReference)
      cloudObjects = buildCloudObjects(sceneReference, worldReference, options)
    })
    buildCourse(scene, world, track)
    state.groundSphereMesh = getBall(scene, undefined, {
      size: GROUND_SPHERE_RADIUS,
      position: GROUND_SPHERE_CENTER,
      color: GROUND_SPHERE_COLOR,
      segments: 64,
      castShadow: false,
      receiveShadow: false
    })
    useDebugSceneStore().addSceneElement({ name: 'Ground', type: 'Mesh', hidden: false })
    registerObjectProperties({ object: state.groundSphereMesh, name: 'Ground', title: 'Ground' })
    state.marbleMesh = getBall(scene, world, {
      size: MARBLE_RADIUS,
      position: track.spawnPosition,
      restitution: MARBLE_RESTITUTION,
      friction: MARBLE_FRICTION,
      weight: MARBLE_WEIGHT,
      texture: deps.marble.value,
      segments: 32,
      type: 'dynamic'
    }) as unknown as ComplexModel
    applyDamping(state.marbleMesh)
    animate({ timeline: buildTimeline(camera, getDelta, state, deps, orbit) })
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    state.finished.value = false
    state.elapsed.value = 0
    state.penaltyCount.value = 0
    state.posAccumulator = 0
    state.controls = createControls({ mapping: KEYBOARD_MAPPING })
    const track = deps.track.value
    const tools = await getTools({ canvas: deps.canvas.value })
    cleanupTools = tools.cleanup
    await tools.setup({
      config: buildSceneSetupConfig(track),
      defineSetup: async ({ orbit }) => {
        await buildGame({
          scene: tools.scene,
          world: tools.world,
          camera: tools.camera,
          getDelta: tools.getDelta,
          animate: tools.animate,
          orbit
        })
        registerCameraProperties({ camera: tools.camera, orbit })
      }
    })
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.marbleMesh = null
    state.controls = null
    state.directionalLight = null
    ghostMeshes.clear()
    sceneReference = null
    worldReference = null
    cloudObjects = []
    state.groundSphereMesh = null
    useDebugSceneStore().removeSceneElement(CLOUD_AREA_NAME)
    useDebugSceneStore().removeSceneElement('Ground')
    useElementPropertiesStore().unregisterElementProperties(CLOUD_AREA_NAME)
    useElementPropertiesStore().unregisterElementProperties('Ground')
    if (cleanupTools) {
      cleanupTools()
      cleanupTools = null
    }
  }

  const updateGhostPosition = (
    peerId: string,
    colorHex: number,
    pos: BallPosPayload,
    texture?: string
  ): void => {
    if (!sceneReference) return
    const ghost = ghostMeshes.get(peerId) ?? makeGhostMarble(sceneReference, colorHex, texture)
    ghostMeshes.set(peerId, ghost)
    ghost.position.set(pos.x, pos.y, pos.z)
  }

  const removeGhost = (peerId: string): void => {
    const ghost = ghostMeshes.get(peerId)
    if (ghost && sceneReference) {
      sceneReference.remove(ghost)
      ghost.geometry.dispose()
      if (ghost.material instanceof THREE.Material) ghost.material.dispose()
    }
    ghostMeshes.delete(peerId)
  }

  watch(
    () => deps.canvas.value,
    (canvas) => {
      if (!canvas) destroy()
    }
  )
  onUnmounted(destroy)

  return {
    elapsed: state.elapsed,
    finished: state.finished,
    penaltyCount: state.penaltyCount,
    init,
    destroy,
    updateGhostPosition,
    removeGhost
  }
}
