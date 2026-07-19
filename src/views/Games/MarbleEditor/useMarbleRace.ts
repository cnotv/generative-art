import { ref, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools, getBall, moveDynamic } from '@webgamekit/threejs'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents, ControlMapping } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import {
  createDirectionalLightFollowAction,
  createPhysicsSyncAction,
  createTimerAction,
  createFallCheckAction
} from '@/utils/gameTimelineActions'
import { applyRaceCamera, createSmoothedDirection, updateSmoothedDirection } from './raceCameras'
import { createGhostRegistry, placeGhost, removeGhost, clearGhosts } from './raceGhosts'
import type { GhostPlacement } from './raceGhosts'
import { createNameLabel, updateNameLabelPosition, disposeNameLabel } from './nameLabels'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { reportInputSource } from '@/composables/useInputDevice'
import { isMenuModalActive } from '@/composables/useMenuNavigation'
import {
  buildTrack,
  computeSpawnPositions,
  isInFinishZone,
  isOnBoostZone,
  nearestCheckpointIndex
} from './trackBuilder'
import { applyPieceTransform } from './chainTransforms'
import { computeTrackBounds, computeRoomLayout } from './bedroomLayout'
import { buildBedroom, applyBedroomAtmosphere } from './bedroomEnvironment'
import type { MarbleMap, BuiltTrack, CameraMode, BallPosPayload, BedroomEnvironment } from './types'
import {
  SPAWN_HEIGHT,
  SPAWN_Z_INSET,
  CONTROLS_GAME_ID,
  BOOST_MAX_SPEED,
  BOOST_IMPULSE,
  FALL_MARGIN,
  TIME_PENALTY_FALL,
  MARBLE_WEIGHT,
  MARBLE_RESTITUTION,
  MARBLE_MOVE_FORCE,
  COUNTDOWN_MS,
  KEYBOARD_MAPPING,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION
} from './config'
import {
  MARBLE_RADIUS,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MAX_LINEAR_SPEED,
  CAMERA_HEIGHT,
  CAMERA_BACK,
  POS_BROADCAST_MS,
  LIGHT_SHADOW_RADIUS,
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA
} from '../MarbleMadness/config'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type WorldReference = NonNullable<GetToolsResult['world']>

export type UseMarbleRaceDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  map: Ref<MarbleMap>
  marbleTexture: Ref<string | undefined>
  onFinish: (elapsedSeconds: number) => void
  onBack?: () => void
  onEditor?: () => void
  onExit?: () => void
  raceStartTime?: Ref<number | null>
  onPositionUpdate?: (pos: BallPosPayload) => void
  localPlayerName?: Ref<string>
  localPlayerColor?: Ref<string>
  spawnGateCount?: Ref<number>
  spawnGateIndex?: Ref<number>
}

type RaceState = {
  marble: ComplexModel | null
  controls: ControlsExtras | null
  builtTrack: BuiltTrack | null
  checkpointIndex: number
  fallThresholdY: number
  directionalLight: THREE.DirectionalLight | null
  smoothedDirection: THREE.Vector3
  cameraActionHeld: boolean
  localLabel: THREE.Sprite | null
  scene: THREE.Scene | null
  bedroom: BedroomEnvironment | null
  posAccumulator: number
}

const VERTICAL_INPUT_REDIRECT_VY = 1
const VERTICAL_INPUT_REDIRECT_SPEED = 4

const computeImpulse = (
  currentActions: ControlsCurrents,
  velocity: { x: number; y: number; z: number },
  forward: { x: number; z: number }
): { x: number; y: number; z: number } => {
  const lateral = ('left' in currentActions ? -1 : 0) + ('right' in currentActions ? 1 : 0)
  const longitudinal =
    ('forward' in currentActions ? 1 : 0) + ('backward' in currentActions ? -1 : 0)
  const x = MARBLE_MOVE_FORCE * (longitudinal * forward.x - lateral * forward.z)
  const z = MARBLE_MOVE_FORCE * (longitudinal * forward.z + lateral * forward.x)
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
  const isClimbing =
    Math.abs(velocity.y) > VERTICAL_INPUT_REDIRECT_VY && speed > VERTICAL_INPUT_REDIRECT_SPEED
  if (longitudinal > 0 && isClimbing) {
    if (speed >= MAX_LINEAR_SPEED)
      return {
        x: x - longitudinal * forward.x * MARBLE_MOVE_FORCE,
        y: 0,
        z: z - longitudinal * forward.z * MARBLE_MOVE_FORCE
      }
    const scale = MARBLE_MOVE_FORCE / speed
    return {
      x: x - longitudinal * forward.x * MARBLE_MOVE_FORCE + velocity.x * scale,
      y: velocity.y * scale,
      z: z - longitudinal * forward.z * MARBLE_MOVE_FORCE + velocity.z * scale
    }
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
  state.smoothedDirection.set(-Math.sin(transform.yaw), 0, -Math.cos(transform.yaw))
}

// Stored custom mappings predate newly added default bindings (camera, back),
// so defaults are merged underneath: a remap wins, but new actions never vanish.
const raceMapping = (): ControlMapping => {
  const stored = loadMapping(CONTROLS_GAME_ID)
  return {
    keyboard: { ...KEYBOARD_MAPPING.keyboard, ...stored?.keyboard },
    gamepad: { ...KEYBOARD_MAPPING.gamepad, ...stored?.gamepad }
  }
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
  marble.userData.body.enableCcd(true)
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
  countdown: Ref<number>
  cameraMode: Ref<CameraMode>
  applyInputAndBoost: () => void
  updateCheckpointAndFinish: () => void
  updateCountdown: () => void
  broadcastPosition: (getDelta: () => number) => void
  updateLocalLabel: () => void
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
  timeline.addAction({
    name: 'race-camera',
    category: 'camera',
    start: 0,
    action: () =>
      applyRaceCamera({
        mode: wiring.cameraMode.value,
        camera,
        marble: state.marble,
        orbit,
        smoothedDirection: state.smoothedDirection
      })
  })
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
  timeline.addAction({
    name: 'countdown',
    category: 'game',
    start: 0,
    action: wiring.updateCountdown
  })
  timeline.addAction({
    name: 'name-labels',
    category: 'ui',
    start: 0,
    action: wiring.updateLocalLabel
  })
  timeline.addAction({
    name: 'pos-broadcast',
    category: 'network',
    start: 0,
    action: () => wiring.broadcastPosition(getDelta)
  })
  timeline.addAction(
    createTimerAction(elapsed, () => finished.value || wiring.countdown.value > 0, getDelta)
  )
  return timeline
}

/**
 * Race mode for the marble editor: builds the current map as a physics track,
 * spawns the player marble, applies controls, tracks checkpoints, falls,
 * boost pads and finish detection.
 */
type RaceReferences = {
  finished: Ref<boolean>
  elapsed: Ref<number>
  penaltyCount: Ref<number>
  countdown: Ref<number>
  cameraMode: Ref<CameraMode>
}

const createRaceActions = (
  deps: UseMarbleRaceDeps,
  state: RaceState,
  refs: RaceReferences,
  getLocalStartTime: () => number
) => {
  const updateCountdown = (): void => {
    const startTime = deps.raceStartTime?.value ?? getLocalStartTime()
    refs.countdown.value = Math.max(0, Math.ceil((startTime + COUNTDOWN_MS - Date.now()) / 1000))
  }

  const broadcastPosition = (getDelta: () => number): void => {
    if (!deps.onPositionUpdate || !state.marble) return
    state.posAccumulator += getDelta() * 1000
    if (state.posAccumulator < POS_BROADCAST_MS) return
    state.posAccumulator = 0
    const pos = state.marble.userData.body.translation()
    const rot = state.marble.userData.body.rotation()
    deps.onPositionUpdate({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rx: rot.x,
      ry: rot.y,
      rz: rot.z,
      rw: rot.w
    })
  }

  const updateLocalLabel = (): void => {
    if (!state.localLabel || !state.marble) return
    updateNameLabelPosition(state.localLabel, state.marble.position)
  }

  const setCameraMode = (mode: CameraMode): void => {
    refs.cameraMode.value = mode
  }

  const cycleCameraMode = (): void => {
    const order: CameraMode[] = ['third', 'first', 'free']
    const nextIndex = (order.indexOf(refs.cameraMode.value) + 1) % order.length
    setCameraMode(order[nextIndex])
  }

  const handleCameraAction = (): void => {
    if (!state.controls) return
    const held = 'camera' in state.controls.currentActions
    if (held && !state.cameraActionHeld) cycleCameraMode()
    state.cameraActionHeld = held
  }

  const inputForward = (): { x: number; z: number } => ({
    x: state.smoothedDirection.x,
    z: state.smoothedDirection.z
  })

  const applyInputAndBoost = (): void => {
    if (!state.marble || !state.controls) return
    handleCameraAction()
    if (refs.finished.value || refs.countdown.value > 0) return
    const body = state.marble.userData.body
    const position = body.translation()
    updateSmoothedDirection(state.smoothedDirection, body.linvel())
    const onBoost =
      state.builtTrack?.boostZones.some((zone) => isOnBoostZone(position, zone)) ?? false
    const impulse = computeImpulse(state.controls.currentActions, body.linvel(), inputForward())
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
    if (!state.marble || !state.builtTrack || refs.finished.value) return
    const position = state.marble.position
    state.checkpointIndex = nearestCheckpointIndex(
      position,
      state.builtTrack.transforms,
      state.checkpointIndex
    )
    if (isInFinishZone(position, state.builtTrack.finishTransform)) {
      refs.finished.value = true
      deps.onFinish(refs.elapsed.value)
    }
  }

  return {
    updateCountdown,
    broadcastPosition,
    updateLocalLabel,
    setCameraMode,
    cycleCameraMode,
    applyInputAndBoost,
    updateCheckpointAndFinish
  }
}

type RaceSceneParameters = {
  tools: GetToolsResult
  orbit: OrbitControls | null
  deps: UseMarbleRaceDeps
  state: RaceState
  ghostRegistry: ReturnType<typeof createGhostRegistry>
}

const buildRaceScene = ({
  tools,
  orbit,
  deps,
  state,
  ghostRegistry
}: RaceSceneParameters): void => {
  if (!tools.world) return
  const scene = tools.scene
  applyBedroomAtmosphere(scene)
  state.directionalLight =
    (scene.children.find(
      (child) => child instanceof THREE.DirectionalLight
    ) as THREE.DirectionalLight) ?? null
  state.scene = scene
  ghostRegistry.scene = scene
  state.builtTrack = buildTrack(scene, tools.world, deps.map.value)
  state.bedroom = buildBedroom(
    scene,
    computeRoomLayout(computeTrackBounds(state.builtTrack.transforms))
  )
  state.fallThresholdY = computeFallThreshold(state.builtTrack)
  const gateCount = Math.max(1, deps.spawnGateCount?.value ?? 1)
  const gateIndex = Math.min(gateCount - 1, Math.max(0, deps.spawnGateIndex?.value ?? 0))
  const spawn = computeSpawnPositions(state.builtTrack.startTransform, gateCount)[gateIndex]
  state.marble = spawnMarble(scene, tools.world, spawn, deps.marbleTexture.value)
  if (deps.localPlayerName?.value) {
    state.localLabel = createNameLabel(
      scene,
      deps.localPlayerName.value,
      deps.localPlayerColor?.value ?? '#ffffff'
    )
  }
  registerCameraProperties({ camera: tools.camera, orbit })
}

/**
 * Race mode composable built on the actions factory above: initializes the
 * scene, drives the timeline, and exposes ghost-marble updates for remote
 * players plus reactive countdown, timing and camera state.
 */
export const useMarbleRace = (deps: UseMarbleRaceDeps) => {
  const finished = ref(false)
  const elapsed = ref(0)
  const penaltyCount = ref(0)
  const countdown = ref(0)
  const cameraMode = ref<CameraMode>('third')
  const currentActions = ref<ControlsCurrents | null>(null)

  const state: RaceState = {
    marble: null,
    controls: null,
    builtTrack: null,
    checkpointIndex: 0,
    fallThresholdY: -FALL_MARGIN,
    directionalLight: null,
    smoothedDirection: createSmoothedDirection(),
    cameraActionHeld: false,
    localLabel: null,
    scene: null,
    bedroom: null,
    posAccumulator: 0
  }
  const ghostRegistry = createGhostRegistry()
  let cleanupTools: (() => void) | null = null
  let localStartTime = 0

  const refs: RaceReferences = { finished, elapsed, penaltyCount, countdown, cameraMode }
  const actions = createRaceActions(deps, state, refs, () => localStartTime)

  const resetRunState = (): void => {
    finished.value = false
    elapsed.value = 0
    penaltyCount.value = 0
    state.checkpointIndex = 0
    state.smoothedDirection.set(0, 0, -1)
    state.cameraActionHeld = false
    state.posAccumulator = 0
    localStartTime = Date.now()
    actions.updateCountdown()
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    resetRunState()
    state.controls = createControls({
      mapping: raceMapping(),
      onAction: (action, _trigger, rawSource) => {
        reportInputSource(String(rawSource ?? 'keyboard'))
        if (isMenuModalActive()) return
        const oneShots: Record<string, (() => void) | undefined> = {
          back: deps.onBack,
          editor: deps.onEditor,
          exit: deps.onExit
        }
        oneShots[action]?.()
      }
    })
    currentActions.value = state.controls.currentActions
    const tools = await getTools({ canvas: deps.canvas.value })
    cleanupTools = tools.cleanup
    state.builtTrack = null
    await tools.setup({
      config: buildRaceSetupConfig(computeSpawnPositions(null, 1)[0]),
      defineSetup: ({ orbit }) => {
        buildRaceScene({ tools, orbit, deps, state, ghostRegistry })
        tools.animate({
          timeline: buildRaceTimeline({
            camera: tools.camera,
            getDelta: tools.getDelta,
            orbit,
            state,
            finished,
            elapsed,
            penaltyCount,
            countdown,
            cameraMode,
            applyInputAndBoost: actions.applyInputAndBoost,
            updateCheckpointAndFinish: actions.updateCheckpointAndFinish,
            updateCountdown: actions.updateCountdown,
            broadcastPosition: actions.broadcastPosition,
            updateLocalLabel: actions.updateLocalLabel
          })
        })
      }
    })
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.controls = null
    currentActions.value = null
    if (state.localLabel && state.scene) disposeNameLabel(state.scene, state.localLabel)
    state.localLabel = null
    clearGhosts(ghostRegistry)
    state.scene = null
    state.marble = null
    state.builtTrack = null
    state.directionalLight = null
    state.bedroom?.dispose()
    state.bedroom = null
    if (cleanupTools) {
      cleanupTools()
      cleanupTools = null
    }
  }

  const updateGhostPosition = (placement: GhostPlacement): void =>
    placeGhost(ghostRegistry, placement)

  const removeGhostMarble = (peerId: string): void => removeGhost(ghostRegistry, peerId)

  onUnmounted(destroy)

  return {
    finished,
    elapsed,
    penaltyCount,
    countdown,
    cameraMode,
    currentActions,
    setCameraMode: actions.setCameraMode,
    cycleCameraMode: actions.cycleCameraMode,
    updateGhostPosition,
    removeGhost: removeGhostMarble,
    init,
    destroy
  }
}
