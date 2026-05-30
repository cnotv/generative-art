import { attachBallStroke, addEdgeLinesToScene } from './marbleVisuals'
import {
  setupCloudArea,
  teardownCloudArea,
  addGroundSphereToScene,
  registerGroundSphereProperties,
  teardownGroundSphere
} from './marbleEnvironment'
import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools, getBall, getCube, moveDynamic, type ComplexModel } from '@webgamekit/threejs'
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
  LIGHT_SHADOW_RADIUS,
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA,
  PLATFORM_HALF_HEIGHT,
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

const FOG_COLOR = 0xb0d8f0
const FOG_DENSITY = 0.0015

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

type GhostRegistry = { meshes: Map<string, THREE.Mesh>; scene: THREE.Scene | null }

const placeGhost = (
  registry: GhostRegistry,
  peerId: string,
  colorHex: number,
  pos: BallPosPayload,
  texture?: string
): void => {
  if (!registry.scene) return
  const ghost = registry.meshes.get(peerId) ?? makeGhostMarble(registry.scene, colorHex, texture)
  registry.meshes.set(peerId, ghost)
  ghost.position.set(pos.x, pos.y + PLATFORM_HALF_HEIGHT, pos.z)
  ghost.quaternion.set(pos.rx, pos.ry, pos.rz, pos.rw)
}

const disposeGhost = (registry: GhostRegistry, peerId: string): void => {
  const ghost = registry.meshes.get(peerId)
  if (ghost && registry.scene) {
    registry.scene.remove(ghost)
    ghost.geometry.dispose()
    if (ghost.material instanceof THREE.Material) ghost.material.dispose()
  }
  registry.meshes.delete(peerId)
}

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
        const rot = state.marbleMesh.userData.body.rotation()
        deps.onPositionUpdate({
          x: pos.x,
          y: pos.y,
          z: pos.z,
          rx: rot.x,
          ry: rot.y,
          rz: rot.z,
          rw: rot.w
        })
        state.posAccumulator = 0
      }
    }
  })

  timeline.addAction(createTimerAction(state.elapsed, () => state.finished.value, getDelta))

  return timeline
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
  const ghostRegistry: GhostRegistry = { meshes: new Map(), scene: null }
  const currentActionsReference = ref<Record<string, unknown>>({})

  const buildGame = async ({ scene, world, camera, getDelta, animate, orbit }: SceneContext) => {
    if (!world) return
    ghostRegistry.scene = scene
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY)
    scene.background = new THREE.Color(FOG_COLOR)
    state.directionalLight =
      (scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight) ??
      null
    const track = deps.track.value
    setupCloudArea(scene, world, () => {})
    buildCourse(scene, world, track)
    state.groundSphereMesh = addGroundSphereToScene(scene)
    registerGroundSphereProperties(state.groundSphereMesh)
    state.marbleMesh = getBall(scene, world, {
      size: MARBLE_RADIUS,
      position: track.spawnPosition,
      restitution: MARBLE_RESTITUTION,
      friction: MARBLE_FRICTION,
      weight: MARBLE_WEIGHT,
      texture: deps.marble.value,
      roughness: 0.08,
      metalness: 0.2,
      segments: 48,
      type: 'dynamic'
    }) as unknown as ComplexModel
    attachBallStroke(state.marbleMesh as unknown as THREE.Mesh)
    applyDamping(state.marbleMesh)
    addEdgeLinesToScene(scene)
    animate({ timeline: buildTimeline(camera, getDelta, state, deps, orbit) })
  }

  const initScene = async (canvas: HTMLCanvasElement): Promise<void> => {
    const track = deps.track.value
    const tools = await getTools({ canvas })
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

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    state.finished.value = false
    state.elapsed.value = 0
    state.penaltyCount.value = 0
    state.posAccumulator = 0
    state.controls = createControls({ mapping: KEYBOARD_MAPPING })
    currentActionsReference.value = state.controls.currentActions as unknown as Record<
      string,
      unknown
    >
    await initScene(deps.canvas.value)
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.marbleMesh = null
    state.controls = null
    state.directionalLight = null
    ghostRegistry.meshes.clear()
    ghostRegistry.scene = null
    state.groundSphereMesh = null
    teardownCloudArea()
    teardownGroundSphere()
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
  ): void => placeGhost(ghostRegistry, peerId, colorHex, pos, texture)

  const removeGhost = (peerId: string): void => disposeGhost(ghostRegistry, peerId)

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
    currentActions: currentActionsReference,
    init,
    destroy,
    updateGhostPosition,
    removeGhost
  }
}
