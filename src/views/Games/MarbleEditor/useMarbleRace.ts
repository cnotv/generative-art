import { ref, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools, getBall, moveDynamic } from '@webgamekit/threejs'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import {
  createCameraFollowAction,
  createDirectionalLightFollowAction,
  createPhysicsSyncAction,
  createTimerAction,
  createFallCheckAction
} from '@/utils/gameTimelineActions'
import { registerCameraProperties } from '@/utils/cameraProperties'
import {
  buildTrack,
  computeSpawnPositions,
  isInFinishZone,
  isOnBoostZone,
  nearestCheckpointIndex
} from './trackBuilder'
import { applyPieceTransform } from './chainTransforms'
import type { MarbleMap, BuiltTrack } from './types'
import {
  SKY_COLOR,
  FOG_DENSITY,
  SPAWN_HEIGHT,
  SPAWN_Z_INSET,
  CONTROLS_GAME_ID,
  BOOST_MAX_SPEED,
  BOOST_IMPULSE,
  FALL_MARGIN,
  TIME_PENALTY_FALL,
  MARBLE_WEIGHT,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION
} from './config'
import {
  MARBLE_RADIUS,
  MARBLE_RESTITUTION,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MOVE_FORCE,
  MAX_LINEAR_SPEED,
  CAMERA_HEIGHT,
  CAMERA_BACK,
  KEYBOARD_MAPPING,
  LIGHT_SHADOW_RADIUS,
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA
} from '../MarbleMadness/config'
import { attachBallStroke, addEdgeLinesToScene } from '../MarbleMadness/marbleVisuals'
import { setupCloudArea, teardownCloudArea } from '../MarbleMadness/marbleEnvironment'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type WorldReference = NonNullable<GetToolsResult['world']>

export type UseMarbleRaceDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  map: Ref<MarbleMap>
  marbleTexture: Ref<string | undefined>
  onFinish: (elapsedSeconds: number) => void
}

type RaceState = {
  marble: ComplexModel | null
  controls: ControlsExtras | null
  builtTrack: BuiltTrack | null
  checkpointIndex: number
  fallThresholdY: number
  directionalLight: THREE.DirectionalLight | null
}

const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_HEIGHT, CAMERA_BACK]

const VERTICAL_INPUT_REDIRECT_VY = 1
const VERTICAL_INPUT_REDIRECT_SPEED = 4

const computeImpulse = (
  currentActions: ControlsCurrents,
  velocity: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
  const x =
    ('left' in currentActions ? -MOVE_FORCE : 0) + ('right' in currentActions ? MOVE_FORCE : 0)
  const z =
    ('forward' in currentActions ? -MOVE_FORCE : 0) +
    ('backward' in currentActions ? MOVE_FORCE : 0)
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
  const isClimbing =
    Math.abs(velocity.y) > VERTICAL_INPUT_REDIRECT_VY && speed > VERTICAL_INPUT_REDIRECT_SPEED
  if (z < 0 && isClimbing) {
    if (speed >= MAX_LINEAR_SPEED) return { x, y: 0, z: 0 }
    const scale = MOVE_FORCE / speed
    return { x: x + velocity.x * scale, y: velocity.y * scale, z: velocity.z * scale }
  }
  return { x, y: 0, z }
}

const respawnAtCheckpoint = (state: RaceState): void => {
  const transform = state.builtTrack?.transforms[state.checkpointIndex]
  if (!state.marble || !transform) return
  const [x, y, z] = applyPieceTransform(transform, [0, SPAWN_HEIGHT, SPAWN_Z_INSET])
  state.marble.userData.body.setTranslation({ x, y, z }, true)
  state.marble.userData.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  state.marble.userData.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

const computeFallThreshold = (builtTrack: BuiltTrack): number =>
  builtTrack.transforms.reduce((lowest, transform) => Math.min(lowest, transform.position[1]), 0) -
  FALL_MARGIN

const spawnMarble = (
  scene: THREE.Scene,
  world: WorldReference,
  position: CoordinateTuple,
  texture: string | undefined
): ComplexModel => {
  const marble = getBall(scene, world, {
    size: MARBLE_RADIUS,
    position,
    restitution: MARBLE_RESTITUTION,
    friction: MARBLE_FRICTION,
    weight: MARBLE_WEIGHT,
    texture,
    roughness: 0.08,
    metalness: 0.2,
    segments: 48,
    type: 'dynamic'
  }) as unknown as ComplexModel
  marble.userData.body.setLinearDamping(MARBLE_LINEAR_DAMPING)
  marble.userData.body.setAngularDamping(MARBLE_ANGULAR_DAMPING)
  attachBallStroke(marble as unknown as THREE.Mesh)
  return marble
}

const buildRaceSetupConfig = (spawn: CoordinateTuple) => ({
  camera: {
    position: [spawn[0], spawn[1] + CAMERA_HEIGHT, spawn[2] + CAMERA_BACK] as CoordinateTuple
  },
  orbit: { disabled: true },
  ground: false as const,
  sky: false as const,
  lights: {
    ambient: { intensity: LIGHT_AMBIENT_INTENSITY },
    directional: {
      intensity: LIGHT_DIRECTIONAL_INTENSITY,
      position: LIGHT_DIRECTIONAL_POSITION,
      shadow: { radius: LIGHT_SHADOW_RADIUS, bias: LIGHT_SHADOW_BIAS, camera: LIGHT_SHADOW_CAMERA }
    }
  }
})

type TimelineWiring = {
  camera: THREE.Camera
  getDelta: () => number
  orbit: OrbitControls | null
  state: RaceState
  finished: Ref<boolean>
  elapsed: Ref<number>
  penaltyCount: Ref<number>
  applyInputAndBoost: () => void
  updateCheckpointAndFinish: () => void
}

const buildRaceTimeline = (wiring: TimelineWiring) => {
  const { camera, getDelta, orbit, state, finished, elapsed, penaltyCount } = wiring
  const timeline = createTimelineManager()
  timeline.addAction({
    name: 'marble-input',
    category: 'physics',
    start: 0,
    action: wiring.applyInputAndBoost
  })
  timeline.addAction(createPhysicsSyncAction(() => state.marble))
  timeline.addAction(
    createDirectionalLightFollowAction(
      () => state.directionalLight,
      () => state.marble,
      LIGHT_DIRECTIONAL_POSITION
    )
  )
  timeline.addAction(
    createCameraFollowAction(
      camera,
      () => state.marble,
      CAMERA_OFFSET,
      () => orbit
    )
  )
  timeline.addAction(
    createFallCheckAction(
      () => state.marble,
      state.fallThresholdY,
      () => {
        elapsed.value += TIME_PENALTY_FALL
        penaltyCount.value += 1
        respawnAtCheckpoint(state)
      }
    )
  )
  timeline.addAction({
    name: 'finish-check',
    category: 'game',
    start: 0,
    action: wiring.updateCheckpointAndFinish
  })
  timeline.addAction(createTimerAction(elapsed, () => finished.value, getDelta))
  return timeline
}

/**
 * Race mode for the marble editor: builds the current map as a physics track,
 * spawns the player marble, applies controls, tracks checkpoints, falls,
 * boost pads and finish detection.
 */
export const useMarbleRace = (deps: UseMarbleRaceDeps) => {
  const finished = ref(false)
  const elapsed = ref(0)
  const penaltyCount = ref(0)

  const state: RaceState = {
    marble: null,
    controls: null,
    builtTrack: null,
    checkpointIndex: 0,
    fallThresholdY: -FALL_MARGIN,
    directionalLight: null
  }
  let cleanupTools: (() => void) | null = null

  const applyInputAndBoost = (): void => {
    if (!state.marble || finished.value || !state.controls) return
    const body = state.marble.userData.body
    const position = body.translation()
    const onBoost =
      state.builtTrack?.boostZones.some((zone) => isOnBoostZone(position, zone)) ?? false
    const impulse = computeImpulse(state.controls.currentActions, body.linvel())
    if (onBoost) {
      const velocity = body.linvel()
      const speed = Math.hypot(velocity.x, velocity.z)
      const scale = speed > 0 ? BOOST_IMPULSE / speed : 0
      body.applyImpulse({ x: velocity.x * scale, y: 0, z: velocity.z * scale }, true)
    }
    if (impulse.x !== 0 || impulse.z !== 0) {
      moveDynamic(state.marble, impulse, onBoost ? BOOST_MAX_SPEED : MAX_LINEAR_SPEED)
    }
  }

  const updateCheckpointAndFinish = (): void => {
    if (!state.marble || !state.builtTrack || finished.value) return
    const position = state.marble.position
    state.checkpointIndex = nearestCheckpointIndex(
      position,
      state.builtTrack.transforms,
      state.checkpointIndex
    )
    if (isInFinishZone(position, state.builtTrack.finishTransform)) {
      finished.value = true
      deps.onFinish(elapsed.value)
    }
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    finished.value = false
    elapsed.value = 0
    penaltyCount.value = 0
    state.checkpointIndex = 0
    state.controls = createControls({
      mapping: loadMapping(CONTROLS_GAME_ID) ?? KEYBOARD_MAPPING
    })
    const tools = await getTools({ canvas: deps.canvas.value })
    cleanupTools = tools.cleanup
    state.builtTrack = null
    const spawnPreview = computeSpawnPositions(null, 1)[0]
    await tools.setup({
      config: buildRaceSetupConfig(spawnPreview),
      defineSetup: ({ orbit }) => {
        if (!tools.world) return
        const scene = tools.scene
        scene.fog = new THREE.FogExp2(SKY_COLOR, FOG_DENSITY)
        scene.background = new THREE.Color(SKY_COLOR)
        state.directionalLight =
          (scene.children.find(
            (child) => child instanceof THREE.DirectionalLight
          ) as THREE.DirectionalLight) ?? null
        setupCloudArea(scene, tools.world, () => {})
        state.builtTrack = buildTrack(scene, tools.world, deps.map.value)
        state.fallThresholdY = computeFallThreshold(state.builtTrack)
        const spawn = computeSpawnPositions(state.builtTrack.startTransform, 1)[0]
        state.marble = spawnMarble(scene, tools.world, spawn, deps.marbleTexture.value)
        addEdgeLinesToScene(scene)
        registerCameraProperties({ camera: tools.camera, orbit })
        tools.animate({
          timeline: buildRaceTimeline({
            camera: tools.camera,
            getDelta: tools.getDelta,
            orbit,
            state,
            finished,
            elapsed,
            penaltyCount,
            applyInputAndBoost,
            updateCheckpointAndFinish
          })
        })
      }
    })
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.controls = null
    state.marble = null
    state.builtTrack = null
    state.directionalLight = null
    teardownCloudArea()
    if (cleanupTools) {
      cleanupTools()
      cleanupTools = null
    }
  }

  onUnmounted(destroy)

  return {
    finished,
    elapsed,
    penaltyCount,
    init,
    destroy
  }
}
