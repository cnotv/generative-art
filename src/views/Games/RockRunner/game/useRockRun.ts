import { ref, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools, getBall, getModel } from '@webgamekit/threejs'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents, ControlMapping } from '@webgamekit/controls'
import { createTimelineManager, updateAnimation } from '@webgamekit/animation'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import rockNormalUrl from '@/assets/images/textures/rock/Rock016_1K-JPG_NormalGL.webp'
import rockRoughnessUrl from '@/assets/images/textures/rock/Rock016_1K-JPG_Roughness.webp'
import rockAmbientOcclusionUrl from '@/assets/images/textures/rock/Rock016_1K-JPG_AmbientOcclusion.webp'
import rockDisplacementUrl from '@/assets/images/textures/rock/Rock016_1K-JPG_Displacement.webp'
import {
  createDirectionalLightFollowAction,
  createPhysicsSyncAction,
  createTimerAction
} from '@/utils/gameTimelineActions'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { reportInputSource } from '@/composables/useInputDevice'
import { isMenuModalActive } from '@/composables/useMenuNavigation'
import { useDebugSceneStore } from '@/stores/debugScene'
import {
  applyRaceCamera,
  createSmoothedDirection,
  updateSmoothedDirection
} from '../../MarbleEditor/game/raceCameras'
import {
  createGhostRegistry,
  placeGhost,
  removeGhost,
  clearGhosts
} from '../../MarbleEditor/game/raceGhosts'
import type { GhostPlacement } from '../../MarbleEditor/game/raceGhosts'
import { createTrackPath } from '../trackPath'
import { createTrackChunkManager } from '../trackChunks'
import { createScatterAreaManager } from '../scatter/scatterAreas'
import { createScatterPanel } from '../scatter/scatterPanel'
import { SCATTER_AREAS } from '../scatter/illustrations'
import { DEFAULT_RUN_CAMERA, registerCameraElements } from '../panel/cameraPanel'
import { registerRockElements } from '../panel/rockPanel'
import { registerStickmanElements } from '../panel/stickmanPanel'
import { attachRockStroke } from '../elements/rockStroke'
import { DEFAULT_ROCK_SURFACE, rockSurfaceById } from '../elements/rockSurfaces'
import { registerTrackElements, createElementVisibilityHandlers } from '../panel/trackPanel'
import { createLateralFogUniforms } from '../lateralFog'
import { createDebrisField } from './debris'
import { stageColorAt } from '../scatter/textureStages'
import {
  advanceDistance,
  autopilotLateralVelocity,
  debrisBurstSize,
  debrisLifetime,
  forwardImpulseMagnitude,
  frameScaledImpulse,
  isGrounded,
  isResting,
  advanceJumpGate,
  jumpReady,
  speedAlong,
  speedCapAt,
  steerDirection,
  steerImpulseMagnitude,
  wallStandoff,
  lateralOffset
} from './rockMotion'
import type {
  CameraMode,
  CharacterType,
  DebrisField,
  LateralFogUniforms,
  JumpGate,
  RockConfig,
  RunCameraConfig,
  RockSurface,
  RockPosPayload,
  ScatterAreaManager,
  StickmanConfig,
  TrackChunkManager,
  TrackPath
} from '../types'
import {
  AUTOPILOT_GAIN,
  AUTOPILOT_MAX_SPEED,
  CONTROLS_GAME_ID,
  COUNTDOWN_MS,
  CHASE_BACK,
  CHASE_HEIGHT,
  DEFAULT_CHARACTER_TYPE,
  STICKMAN_MODEL_PATH,
  DEBRIS_EMIT_INTERVAL,
  DEBRIS_GROUND_COLOR,
  DEBRIS_GROUND_TOLERANCE,
  DEBRIS_LIFETIME,
  DEBRIS_MIN_BURST,
  DEBRIS_MIN_LIFETIME,
  DEBRIS_MIN_SPEED,
  DEBRIS_PER_BURST,
  DEBRIS_TRAIL_OFFSET,
  DISTANCE_BROADCAST_MS,
  FOG_COLOR,
  FOG_FAR,
  FOG_STAGE_COLORS,
  FOG_NEAR,
  FOG_SIDE_FAR,
  FOG_SIDE_NEAR,
  GROUND_PROBE_SLACK,
  JUMP_BUFFER_SECONDS,
  JUMP_COYOTE_SECONDS,
  JUMP_RISING_TOLERANCE,
  ROCK_MASS,
  KEYBOARD_MAPPING,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  ROCK_ANGULAR_DAMPING,
  ROCK_FRICTION,
  ROCK_NORMAL_SCALE,
  ROCK_LINEAR_DAMPING,
  ROCK_RADIUS,
  ROCK_AO_INTENSITY,
  ROCK_DISPLACEMENT_SCALE,
  ROCK_RESTITUTION,
  GHOST_SEGMENTS,
  ROCK_SEGMENTS,
  ROCK_SPAWN_HEIGHT,
  ROCK_STROKE_WIDTH,
  ROCK_STROKE_WOBBLE,
  ROCK_TEXTURE_REPEAT,
  ROCK_GRAVITY_SCALE,
  SKY_COLOR,
  TERRAIN_STAGE_TINTS,
  ROCK_STROKE_COLOR,
  SCATTER_CHUNK_LENGTH,
  SPAWN_GATE_SPREAD,
  TRACK_WIDTH,
  WALL_ELEMENT_NAME,
  WALL_HEIGHT,
  WALL_THICKNESS
} from '../config'
import {
  LIGHT_SHADOW_RADIUS,
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA
} from '../../MarbleMadness/config'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type WorldReference = NonNullable<GetToolsResult['world']>

export type UseRockRunDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  seed: Ref<number>
  onBack?: () => void
  onExit?: () => void
  runStartTime?: Ref<number | null>
  onPositionUpdate?: (pos: RockPosPayload) => void
  localPlayerName?: Ref<string>
  localPlayerColor?: Ref<string>
  spawnGateCount?: Ref<number>
  spawnGateIndex?: Ref<number>
  rockSurface?: Ref<string>
  characterType?: Ref<CharacterType>
  /** Route name the config panel keys the rock's physics by. */
  routeName?: string
}

type RunState = {
  rockConfig: RockConfig | null
  cameraConfig: RunCameraConfig | null
  rockSurface: RockSurface | null
  rock: ComplexModel | null
  /** A stickman riding the rock's invisible sphere, when that look is chosen. */
  stickman: ComplexModel | null
  stickmanConfig: StickmanConfig | null
  world: WorldReference | null
  scene: THREE.Scene | null
  controls: ControlsExtras | null
  path: TrackPath | null
  track: TrackChunkManager | null
  scatter: ScatterAreaManager[]
  distance: number
  directionalLight: THREE.DirectionalLight | null
  smoothedDirection: THREE.Vector3
  cameraActionHeld: boolean
  jumpActionHeld: boolean
  jumpGate: JumpGate
  prevCameraMode: CameraMode
  cameraTransitionElapsed: number
  cameraTransitionStart: THREE.Vector3
  posAccumulator: number
  released: boolean
  rockMaps: RockMaps | null
  debris: DebrisField | null
  applyFogColor: ((color: number) => void) | null
  lateralFog: LateralFogUniforms | null
  rockTextures: THREE.Texture[]
  disposePanels: (() => void)[]
}

type RunReferences = {
  elapsed: Ref<number>
  distance: Ref<number>
  countdown: Ref<number>
  cameraMode: Ref<CameraMode>
}

// Impulses are recomputed every frame, so the vector they are written into is
// allocated once here rather than inside the loop.
const scratchImpulse = { x: 0, y: 0, z: 0 }
const scratchVelocity = { x: 0, y: 0, z: 0 }
const ZERO_VELOCITY = { x: 0, y: 0, z: 0 }
const scratchOrigin = new THREE.Vector3()
const STICKMAN_UP_AXIS = new THREE.Vector3(0, 1, 0)

const CAMERA_ORDER: CameraMode[] = ['third', 'first', 'free']

const runMapping = (): ControlMapping => {
  const stored = loadMapping(CONTROLS_GAME_ID)
  return {
    keyboard: { ...KEYBOARD_MAPPING.keyboard, ...stored?.keyboard },
    gamepad: { ...KEYBOARD_MAPPING.gamepad, ...stored?.gamepad }
  }
}

// The rock uses the full PBR set rather than a colour map alone: the normal and
// roughness maps are what make a sphere read as stone rather than as a painted
// ball, and the displacement map needs the high segment count below to show.
const loadRockMaps = (surface: RockSurface) => {
  const loader = new THREE.TextureLoader()
  const wrap = (url: string, isColor: boolean): THREE.Texture => {
    const texture = loader.load(url)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(ROCK_TEXTURE_REPEAT, ROCK_TEXTURE_REPEAT)
    if (isColor) texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
  // The relief maps come from the scanned stone and describe it alone. A painted
  // tile lit by them wears another rock's cracks, so it gets colour only.
  const relief = surface.relief
  return {
    map: wrap(surface.colorUrl, true),
    normalMap: relief ? wrap(rockNormalUrl, false) : null,
    roughnessMap: relief ? wrap(rockRoughnessUrl, false) : null,
    aoMap: relief ? wrap(rockAmbientOcclusionUrl, false) : null,
    displacementMap: relief ? wrap(rockDisplacementUrl, false) : null
  }
}

type RockMaps = ReturnType<typeof loadRockMaps>

/**
 * Dresses a ball as stone. Every rock in the scene shares one set of maps, so a
 * room full of players costs the same five textures as one.
 *
 * @param mesh - Ball to dress, its material mutated in place
 * @param maps - The shared texture set
 * @param tint - Multiplied over the albedo; the player's colour for a ghost
 * @param displaced - Whether to displace geometry, which only the local rock has
 *   the segment count to carry
 */
const applyRockMaterial = (
  mesh: THREE.Mesh,
  maps: RockMaps,
  tint: number,
  displaced: boolean
): void => {
  const material = mesh.material as THREE.MeshStandardMaterial
  material.map = maps.map
  material.normalMap = maps.normalMap
  material.roughnessMap = maps.roughnessMap
  material.aoMap = maps.aoMap
  material.displacementMap = displaced ? maps.displacementMap : null
  if (displaced && maps.displacementMap) {
    material.displacementScale = ROCK_DISPLACEMENT_SCALE
    material.displacementBias = -ROCK_DISPLACEMENT_SCALE / 2
  }
  material.aoMapIntensity = ROCK_AO_INTENSITY
  material.normalScale.set(ROCK_NORMAL_SCALE, ROCK_NORMAL_SCALE)
  material.color.setHex(tint)
  material.roughness = 1
  material.metalness = 0
  material.needsUpdate = true
}

const spawnRock = (
  scene: THREE.Scene,
  world: WorldReference,
  position: CoordinateTuple,
  dressing: { maps: RockMaps; tint: number; displaced: boolean }
): ComplexModel => {
  const rock = getBall(scene, world, {
    name: 'player-rock',
    size: ROCK_RADIUS,
    position,
    restitution: ROCK_RESTITUTION,
    friction: ROCK_FRICTION,
    weight: ROCK_GRAVITY_SCALE,
    mass: ROCK_MASS,
    roughness: 1,
    metalness: 0,
    segments: ROCK_SEGMENTS,
    type: 'dynamic'
  }) as unknown as ComplexModel
  rock.userData.body.setLinearDamping(ROCK_LINEAR_DAMPING)
  rock.userData.body.setAngularDamping(ROCK_ANGULAR_DAMPING)
  rock.userData.body.enableCcd(true)
  applyRockMaterial(rock as unknown as THREE.Mesh, dressing.maps, dressing.tint, dressing.displaced)
  attachRockStroke(rock, ROCK_STROKE_WIDTH, ROCK_STROKE_WOBBLE)
  return rock
}

const buildRunSetupConfig = (spawn: CoordinateTuple) => ({
  camera: {
    position: [spawn[0], spawn[1] + CHASE_HEIGHT, spawn[2] + CHASE_BACK] as CoordinateTuple
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

/**
 * Spreads players across the start line so several rocks can share the track
 * without spawning inside each other.
 *
 * @param path - The track being run
 * @param gateCount - How many players are starting
 * @param gateIndex - Which slot this player takes
 * @returns The world-space spawn position
 */
export const spawnPosition = (
  path: TrackPath,
  gateCount: number,
  gateIndex: number
): CoordinateTuple => {
  const sample = path.sampleAt(0)
  const offset = gateCount === 1 ? 0 : (gateIndex / (gateCount - 1) - 0.5) * 2 * SPAWN_GATE_SPREAD
  return [
    sample.position.x + sample.right.x * offset,
    sample.position.y + ROCK_SPAWN_HEIGHT,
    sample.position.z + sample.right.z * offset
  ]
}

// The rock is pinned until the countdown clears. Killing its velocity alone
// would still let gravity build speed up each frame and slide it down the slope
// it spawned on, so gravity is switched off for the wait and restored exactly
// once when the run begins.
/**
 * Holds the rock still through the countdown and releases it into the run.
 *
 * @param state - The run's mutable state, holding the rock
 * @returns The gate's hold and release handlers
 */
export const createStartGate = (state: RunState) => ({
  hold: (): void => {
    if (!state.rock) return
    const body = state.rock.userData.body
    if (state.released) {
      body.setGravityScale(0, true)
      state.released = false
    }
    body.setLinvel(ZERO_VELOCITY, true)
    body.setAngvel(ZERO_VELOCITY, true)
  },
  release: (): void => {
    if (state.released || !state.rock) return
    // Restores the rock's own gravity rather than the world's. Resetting to 1
    // here looked like undoing what the countdown switched off and was not: it
    // threw the setting away for the entire run. The panel is preferred over
    // the constant so a gravity edited during the countdown survives it.
    state.rock.userData.body.setGravityScale(
      state.rockConfig?.gravityScale ?? ROCK_GRAVITY_SCALE,
      true
    )
    state.released = true
  }
})

// The rock rests one radius above the deck, so the probe has to follow the
// radius rather than a figure fixed at the size it happened to spawn at.
const groundProbeFor = (radius: number): number => radius + GROUND_PROBE_SLACK

const speedCapFor = (rock: RockConfig, distance: number): number =>
  speedCapAt(distance, rock.baseMaxSpeed, rock.maxSpeedCeiling, rock.speedRampDistance)

// Chips appear just forward of the contact patch and are immediately left
// behind, so they read as scuffed off the ground rather than falling out of the
// ball. Kept out of the actions factory to hold that factory under its line
// limit.
const createDebrisEmitter =
  (state: RunState) =>
  (delta: number): void => {
    if (!state.rock || !state.path || !state.debris) return
    const body = state.rock.userData.body
    const position = body.translation()
    const sample = state.path.sampleAt(state.distance)
    const rock = state.rockConfig
    if (!rock) return
    if (!isResting(position.y, sample.position.y, rock.radius, DEBRIS_GROUND_TOLERANCE)) return
    const speed = Math.hypot(body.linvel().x, body.linvel().z)
    if (speed < DEBRIS_MIN_SPEED) return
    if (!state.debris.shouldEmit(delta, DEBRIS_EMIT_INTERVAL)) return
    scratchOrigin.set(
      position.x + sample.forward.x * ROCK_RADIUS * DEBRIS_TRAIL_OFFSET,
      sample.position.y,
      position.z + sample.forward.z * ROCK_RADIUS * DEBRIS_TRAIL_OFFSET
    )
    // A burst rather than a single chip: at speed the rock outruns its own
    // trail, so one per tick leaves the ground looking untouched. The spray
    // grows with how fast it is going.
    const cap = speedCapFor(rock, state.distance)
    const burst = debrisBurstSize(speed, cap, DEBRIS_PER_BURST, DEBRIS_MIN_BURST)
    const lifetime = debrisLifetime(speed, cap, DEBRIS_LIFETIME, DEBRIS_MIN_LIFETIME)
    Array.from({ length: burst }).forEach(() =>
      state.debris?.emit({
        origin: scratchOrigin,
        forward: sample.forward,
        right: sample.right,
        samples: [Math.random(), Math.random(), Math.random()],
        lifetime
      })
    )
  }

// The fog and the side ground follow the rock rather than any one chunk: they
// are a single colour over the whole scene, so they blend as it advances. The
// scenery instead comes staged into each chunk as it is built.
const createStageDriver = (state: RunState) => (): void => {
  state.applyFogColor?.(stageColorAt(state.distance, FOG_STAGE_COLORS))
  state.track?.setTerrainTint(stageColorAt(state.distance, TERRAIN_STAGE_TINTS))
}

const createJumpAction =
  (state: RunState) =>
  (delta: number): void => {
    if (!state.rock || !state.controls || !state.path || !state.rockConfig) return
    const body = state.rock.userData.body
    const rock = state.rockConfig
    const held = 'jump' in state.controls.currentActions
    const pressed = held && !state.jumpActionHeld
    state.jumpActionHeld = held
    state.jumpGate = advanceJumpGate(state.jumpGate, delta, {
      pressed,
      grounded: isGrounded(
        body.translation().y,
        state.path.sampleAt(state.distance).position.y,
        body.linvel().y,
        groundProbeFor(rock.radius),
        JUMP_RISING_TOLERANCE
      ),
      bufferSeconds: JUMP_BUFFER_SECONDS,
      coyoteSeconds: JUMP_COYOTE_SECONDS
    })
    if (!jumpReady(state.jumpGate)) return
    scratchImpulse.x = 0
    scratchImpulse.y = rock.jumpImpulse
    scratchImpulse.z = 0
    body.applyImpulse(scratchImpulse, true)
    // Both graces are spent, or the same press would keep firing on the way up.
    state.jumpGate = { buffer: 0, coyote: 0, cooldown: rock.jumpCooldown }
  }

const createDriveAction =
  (state: RunState) =>
  (delta: number): void => {
    if (!state.rock || !state.controls || !state.path || !state.rockConfig) return
    const sample = state.path.sampleAt(state.distance)
    const body = state.rock.userData.body
    const rock = state.rockConfig
    // The stickman rides the rock's own invisible sphere: same position, but
    // yawed to face the track's forward direction instead of inheriting the
    // sphere's full roll, and animated by a continuous run cycle rather than
    // moved by any physics of its own.
    if (state.stickman && state.stickmanConfig) {
      const stickmanConfig = state.stickmanConfig
      state.stickman.scale.setScalar(stickmanConfig.scale)
      const position = body.translation()
      state.stickman.position.set(position.x, position.y + stickmanConfig.groundOffset, position.z)
      const yaw = Math.atan2(-sample.forward.x, -sample.forward.z)
      state.stickman.quaternion.setFromAxisAngle(STICKMAN_UP_AXIS, yaw)
      updateAnimation({ actionName: 'walk', player: state.stickman, delta })
    }
    const steer = steerDirection(state.controls.currentActions)
    // Self driving is a hands-off default, not an assist the player has to
    // fight: the first steering press hands control back rather than adding
    // to it, so it only ever turns off on its own, never back on.
    if (rock.autopilot && steer !== 0) rock.autopilot = false
    // The self-driving assist is a velocity servo rather than an impulse: it
    // directly commands the lateral component of the body's own velocity
    // toward the centreline every frame, leaving the forward and vertical
    // components untouched, so it holds the rock to the middle continuously
    // instead of nudging it with a force that has to fight momentum.
    if (rock.autopilot) {
      const currentVelocity = body.linvel()
      const forwardComponent = speedAlong(currentVelocity, sample.forward)
      const offset = lateralOffset(body.translation(), sample.position, sample.right)
      const centeringVelocity = autopilotLateralVelocity(
        offset,
        AUTOPILOT_GAIN,
        AUTOPILOT_MAX_SPEED
      )
      scratchVelocity.x = sample.forward.x * forwardComponent + sample.right.x * centeringVelocity
      scratchVelocity.y = currentVelocity.y
      scratchVelocity.z = sample.forward.z * forwardComponent + sample.right.z * centeringVelocity
      body.setLinvel(scratchVelocity, true)
    }
    const velocity = body.linvel()
    const forwardMagnitude = forwardImpulseMagnitude(
      speedAlong(velocity, sample.forward),
      speedCapFor(rock, state.distance),
      rock.forwardImpulse
    )
    // Steering is capped by lateral speed, and a rock held against a wall never
    // gains any, so the cap never engaged and the game pressed into the wall at
    // full force for as long as the key was held. That normal force against the
    // rock's grip is what brought it to a halt at the track edge, so steering
    // stops at the wall itself rather than only at a speed.
    const lateralMagnitude = steerImpulseMagnitude(steer, rock.steerImpulse, {
      lateralSpeed: speedAlong(velocity, sample.right),
      speedCap: rock.maxLateralSpeed,
      offset: lateralOffset(body.translation(), sample.position, sample.right),
      standoff: wallStandoff(state.track?.deckWidth() ?? TRACK_WIDTH, rock.radius)
    })
    if (forwardMagnitude === 0 && lateralMagnitude === 0) return
    const forward = frameScaledImpulse(forwardMagnitude, delta)
    const lateral = frameScaledImpulse(lateralMagnitude, delta)
    scratchImpulse.x = sample.forward.x * forward + sample.right.x * lateral
    scratchImpulse.y = 0
    scratchImpulse.z = sample.forward.z * forward + sample.right.z * lateral
    body.applyImpulse(scratchImpulse, true)
  }

// Splitting rise from fall is the only way to make the drop snappy without
// flattening the jump, since one gravity otherwise governs both halves of the
// arc. Set every frame rather than on the way past the apex: the rock can be
// knocked out of a climb at any point, and a one-shot switch would miss it.

const createRunActions = (
  deps: UseRockRunDeps,
  state: RunState,
  refs: RunReferences,
  getLocalStartTime: () => number
) => {
  const startGate = createStartGate(state)
  const emitDebris = createDebrisEmitter(state)
  const applyJump = createJumpAction(state)
  const applyDrive = createDriveAction(state)
  const advanceStage = createStageDriver(state)

  const setCameraMode = (mode: CameraMode): void => {
    refs.cameraMode.value = mode
  }

  const cycleCameraMode = (): void =>
    setCameraMode(
      CAMERA_ORDER[(CAMERA_ORDER.indexOf(refs.cameraMode.value) + 1) % CAMERA_ORDER.length]
    )

  const handleCameraAction = (): void => {
    if (!state.controls) return
    const held = 'camera' in state.controls.currentActions
    if (held && !state.cameraActionHeld) cycleCameraMode()
    state.cameraActionHeld = held
  }

  const applyInput = (getDelta: () => number): void => {
    handleCameraAction()
    if (!state.rock) return
    if (refs.countdown.value > 0) {
      startGate.hold()
      return
    }
    startGate.release()
    updateSmoothedDirection(state.smoothedDirection, state.rock.userData.body.linvel())
    applyJump(getDelta())
    applyDrive(getDelta())
    emitDebris(getDelta())
  }

  const updateDistance = (): void => {
    if (!state.rock || !state.path) return
    const position = state.rock.userData.body.translation()
    // Two projections per frame: the first lands close, the second removes the
    // residual error left by the path's curvature over that step.
    state.distance = advanceDistance(state.path, state.distance, position)
    state.distance = advanceDistance(state.path, state.distance, position)
    refs.distance.value = state.distance
  }

  // The fog walks the same stages as the scenery, so the wood changes character
  // as a whole rather than the trees swapping inside an unchanged haze.
  const pumpWorld = (): void => {
    advanceStage()
    // pump, not ensureAhead: at most one chunk per manager per frame, so a
    // device that has fallen behind never has to build several trimesh
    // colliders and InstancedMeshes in the same frame — it catches up over a
    // few frames instead of spiking one.
    state.track?.pump(state.distance)
    state.track?.prune(state.distance)
    state.scatter.forEach((area) => {
      area.pump(state.distance)
      area.prune(state.distance)
    })
  }

  const updateCountdown = (): void => {
    const startTime = deps.runStartTime?.value ?? getLocalStartTime()
    refs.countdown.value = Math.max(0, Math.ceil((startTime + COUNTDOWN_MS - Date.now()) / 1000))
  }

  const broadcastPosition = (getDelta: () => number): void => {
    if (!deps.onPositionUpdate || !state.rock) return
    state.posAccumulator += getDelta() * 1000
    if (state.posAccumulator < DISTANCE_BROADCAST_MS) return
    state.posAccumulator = 0
    const pos = state.rock.userData.body.translation()
    const rot = state.rock.userData.body.rotation()
    deps.onPositionUpdate({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rx: rot.x,
      ry: rot.y,
      rz: rot.z,
      rw: rot.w,
      d: state.distance
    })
  }

  return {
    setCameraMode,
    cycleCameraMode,
    applyInput,
    updateDistance,
    pumpWorld,
    updateDebris: (delta: number) => state.debris?.update(delta),
    updateCountdown,
    broadcastPosition
  }
}

type RunActions = ReturnType<typeof createRunActions>

type TimelineWiring = {
  camera: THREE.Camera
  getDelta: () => number
  orbit: OrbitControls | null
  state: RunState
  refs: RunReferences
  actions: RunActions
}

const buildRunTimeline = ({ camera, getDelta, orbit, state, refs, actions }: TimelineWiring) => {
  const timeline = createTimelineManager()
  timeline.addAction({
    name: 'rock-input',
    category: 'physics',
    start: 0,
    action: () => actions.applyInput(getDelta)
  })
  timeline.addAction(createPhysicsSyncAction(() => state.rock))
  timeline.addAction({
    name: 'distance-tracking',
    category: 'game',
    start: 0,
    action: actions.updateDistance
  })
  timeline.addAction({
    name: 'world-streaming',
    category: 'game',
    start: 0,
    action: actions.pumpWorld
  })
  timeline.addAction({
    name: 'debris',
    category: 'physics',
    start: 0,
    action: () => actions.updateDebris(getDelta())
  })
  timeline.addAction(
    createDirectionalLightFollowAction(
      () => state.directionalLight,
      () => state.rock,
      LIGHT_DIRECTIONAL_POSITION
    )
  )
  timeline.addAction({
    name: 'run-camera',
    category: 'camera',
    start: 0,
    action: () => {
      const mode = refs.cameraMode.value
      if (mode !== state.prevCameraMode) {
        state.cameraTransitionElapsed = 0
        state.cameraTransitionStart.copy(camera.position)
      } else {
        state.cameraTransitionElapsed += getDelta()
      }
      const cameras = state.cameraConfig ?? DEFAULT_RUN_CAMERA
      applyRaceCamera({
        mode,
        camera,
        marble: state.rock,
        orbit,
        smoothedDirection: state.smoothedDirection,
        transitionStart: state.cameraTransitionStart,
        transitionAlpha: Math.min(
          1,
          state.cameraTransitionElapsed / Math.max(0.01, cameras.transitionSeconds)
        ),
        thirdPersonHeight: cameras.thirdPersonHeight,
        thirdPersonBack: cameras.thirdPersonBack,
        firstPersonHeight: cameras.firstPersonHeight,
        firstPersonForward: cameras.firstPersonForward,
        firstPersonLookAhead: cameras.firstPersonLookAhead,
        freeCamHeight: cameras.freeCamHeight,
        freeCamBack: cameras.freeCamBack
      })
      state.prevCameraMode = mode
    }
  })
  timeline.addAction({
    name: 'countdown',
    category: 'game',
    start: 0,
    action: actions.updateCountdown
  })
  timeline.addAction({
    name: 'pos-broadcast',
    category: 'network',
    start: 0,
    action: () => actions.broadcastPosition(getDelta)
  })
  timeline.addAction(createTimerAction(refs.elapsed, () => refs.countdown.value > 0, getDelta))
  return timeline
}

type WorldParameters = {
  tools: GetToolsResult
  orbit: OrbitControls | null
  deps: UseRockRunDeps
  state: RunState
  ghostRegistry: ReturnType<typeof createGhostRegistry>
  cameraMode: Ref<CameraMode>
  setCameraMode: (mode: CameraMode) => void
  pumpWorld: () => void
}

const applyRunAtmosphere = (scene: THREE.Scene): THREE.DirectionalLight | null => {
  scene.background = new THREE.Color(SKY_COLOR)
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR)
  return (
    (scene.children.find(
      (child) => child instanceof THREE.DirectionalLight
    ) as THREE.DirectionalLight) ?? null
  )
}

const buildRunWorld = async ({
  tools,
  orbit,
  deps,
  state,
  ghostRegistry,
  pumpWorld,
  cameraMode,
  setCameraMode
}: WorldParameters): Promise<void> => {
  if (!tools.world) return
  const scene = tools.scene
  state.scene = scene
  state.world = tools.world
  ghostRegistry.scene = scene
  state.directionalLight = applyRunAtmosphere(scene)

  const path = createTrackPath(deps.seed.value)
  state.path = path

  const scatterPanel = createScatterPanel()
  const lateralFog = createLateralFogUniforms(FOG_COLOR, FOG_SIDE_NEAR, FOG_SIDE_FAR)
  state.lateralFog = lateralFog
  const track = createTrackChunkManager({
    scene,
    world: tools.world,
    path,
    wall: { height: WALL_HEIGHT, thickness: WALL_THICKNESS },
    lateralFog
  })
  state.track = track
  state.scatter = SCATTER_AREAS.map((definition, index) =>
    createScatterAreaManager({
      scene,
      path,
      definition,
      lateralFog,
      getConfig: () => scatterPanel.areaConfig(definition.name),
      getTextures: (distance: number) => scatterPanel.areaTextures(definition.name, distance),
      // Every area shares one chunk length, so left unstaggered they would all
      // fall due for a new chunk on the same frame. Spread evenly across one
      // chunk's length, so their rebuilds land on different frames instead.
      chunkPhase: (index * SCATTER_CHUNK_LENGTH) / SCATTER_AREAS.length
    })
  )

  const debugSceneStore = useDebugSceneStore()
  debugSceneStore.setSceneElements(
    [],
    createElementVisibilityHandlers({
      [WALL_ELEMENT_NAME]: (hidden) => track.setWallsVisible(!hidden)
    })
  )
  registerCameraProperties({ camera: tools.camera, orbit })
  // Registered after setSceneElements, which replaces the list wholesale and
  // would otherwise drop anything added before it.
  const cameraPanel = registerCameraElements({ mode: cameraMode, setMode: setCameraMode })
  state.cameraConfig = cameraPanel.config
  const rockPanel = registerRockElements({
    routeName: deps.routeName ?? 'RockRunner',
    getRock: () => state.rock ?? undefined
  })
  state.rockConfig = rockPanel.config
  state.disposePanels = [
    registerTrackElements({
      manager: track,
      getDistance: () => state.distance,
      scene,
      lateralFog,
      onStageColor: (apply) => {
        state.applyFogColor = apply
      }
    }),
    scatterPanel.teardown,
    rockPanel.teardown,
    cameraPanel.teardown
  ]
  scatterPanel.register(state.scatter, () => state.distance)

  const gateCount = Math.max(1, deps.spawnGateCount?.value ?? 1)
  const gateIndex = Math.min(gateCount - 1, Math.max(0, deps.spawnGateIndex?.value ?? 0))
  state.debris = createDebrisField(scene, [DEBRIS_GROUND_COLOR])
  const surface = rockSurfaceById(deps.rockSurface?.value ?? DEFAULT_ROCK_SURFACE)
  const maps = loadRockMaps(surface)
  state.rockSurface = surface
  state.rockMaps = maps
  state.rockTextures = Object.values(maps)
  const startPosition = spawnPosition(path, gateCount, gateIndex)
  state.rock = spawnRock(scene, tools.world, startPosition, {
    maps,
    tint: surface.tint,
    displaced: surface.relief
  })
  // Cosmetic swap only: the stickman has no physics of its own, it rides the
  // rock's own invisible sphere every frame (createDriveAction), so every
  // existing steering/jump/autopilot system keeps working untouched.
  if ((deps.characterType?.value ?? DEFAULT_CHARACTER_TYPE) === 'stickman') {
    state.rock.visible = false
    const stickmanPanel = registerStickmanElements()
    state.stickmanConfig = stickmanPanel.config
    state.disposePanels.push(stickmanPanel.teardown)
    state.stickman = await getModel(scene, tools.world, STICKMAN_MODEL_PATH, {
      position: startPosition,
      scale: [stickmanPanel.config.scale, stickmanPanel.config.scale, stickmanPanel.config.scale],
      type: 'kinematicPositionBased',
      hasGravity: false,
      castShadow: true
    })
  }
  // The rock is built from the constants, so anything already edited in the
  // panel has to be pushed onto it before the countdown starts.
  rockPanel.apply()
  pumpWorld()
}

const createRunState = (): RunState => ({
  rockConfig: null,
  cameraConfig: null,
  rockSurface: null,
  rock: null,
  stickman: null,
  stickmanConfig: null,
  world: null,
  scene: null,
  controls: null,
  path: null,
  track: null,
  scatter: [],
  distance: 0,
  directionalLight: null,
  smoothedDirection: createSmoothedDirection(),
  cameraActionHeld: false,
  jumpActionHeld: false,
  jumpGate: { buffer: 0, coyote: 0, cooldown: 0 },
  prevCameraMode: 'third',
  cameraTransitionElapsed: 0,
  cameraTransitionStart: new THREE.Vector3(),
  posAccumulator: 0,
  released: true,
  rockMaps: null,
  debris: null,
  applyFogColor: null,
  lateralFog: null,
  rockTextures: [],
  disposePanels: []
})

/**
 * The endless run: an auto-forward rock steered along a seeded procedural
 * track, with the ground and every illustration area generated ahead of it and
 * disposed behind.
 *
 * @param deps - Canvas, track seed, networking hooks and player identity
 * @returns Reactive run state plus lifecycle and ghost controls
 */
export const useRockRun = (deps: UseRockRunDeps) => {
  const refs: RunReferences = {
    elapsed: ref(0),
    distance: ref(0),
    countdown: ref(0),
    cameraMode: ref<CameraMode>('third')
  }
  const currentActions = ref<ControlsCurrents | null>(null)
  const state = createRunState()
  const ghostRegistry = createGhostRegistry()
  let cleanupTools: (() => void) | null = null
  let localStartTime = 0

  const actions = createRunActions(deps, state, refs, () => localStartTime)

  const resetRunState = (): void => {
    refs.elapsed.value = 0
    refs.distance.value = 0
    refs.cameraMode.value = 'third'
    state.distance = 0
    state.smoothedDirection.set(0, 0, -1)
    state.cameraActionHeld = false
    state.jumpActionHeld = false
    state.jumpCooldown = 0
    state.prevCameraMode = 'third'
    state.cameraTransitionElapsed = 0
    state.posAccumulator = 0
    state.released = true
    localStartTime = Date.now()
    actions.updateCountdown()
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    resetRunState()
    state.controls = createControls({
      mapping: runMapping(),
      onAction: (action, _trigger, rawSource) => {
        reportInputSource(String(rawSource ?? 'keyboard'))
        if (isMenuModalActive()) return
        const oneShots: Record<string, (() => void) | undefined> = {
          back: deps.onBack,
          exit: deps.onExit
        }
        oneShots[action]?.()
      }
    })
    currentActions.value = state.controls.currentActions
    const tools = await getTools({ canvas: deps.canvas.value })
    cleanupTools = tools.cleanup
    await tools.setup({
      config: buildRunSetupConfig(spawnPosition(createTrackPath(deps.seed.value), 1, 0)),
      defineSetup: async ({ orbit }) => {
        await buildRunWorld({
          tools,
          orbit,
          deps,
          state,
          ghostRegistry,
          pumpWorld: actions.pumpWorld,
          cameraMode: refs.cameraMode,
          setCameraMode: actions.setCameraMode
        })
        tools.animate({
          timeline: buildRunTimeline({
            camera: tools.camera,
            getDelta: tools.getDelta,
            orbit,
            state,
            refs,
            actions
          })
        })
      }
    })
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.controls = null
    currentActions.value = null
    clearGhosts(ghostRegistry)
    state.disposePanels.forEach((dispose) => dispose())
    state.disposePanels = []
    state.scatter.forEach((area) => area.teardown())
    state.scatter = []
    state.track?.teardown()
    state.track = null
    state.path = null
    state.debris?.teardown()
    state.debris = null
    state.rockTextures.forEach((texture) => texture.dispose())
    state.rockTextures = []
    state.rockMaps = null
    state.rock = null
    state.stickman = null
    state.stickmanConfig = null
    state.world = null
    state.scene = null
    state.directionalLight = null
    if (cleanupTools) {
      cleanupTools()
      cleanupTools = null
    }
  }

  onUnmounted(destroy)

  return {
    elapsed: refs.elapsed,
    distance: refs.distance,
    countdown: refs.countdown,
    cameraMode: refs.cameraMode,
    currentActions,
    setCameraMode: actions.setCameraMode,
    cycleCameraMode: actions.cycleCameraMode,
    // Other players' rocks match the local one in size and material, tinted by
    // their own colour. They skip displacement: at a ghost's segment count
    // there is nothing for it to move.
    updateGhostPosition: (placement: GhostPlacement) =>
      placeGhost(ghostRegistry, {
        ...placement,
        size: ROCK_RADIUS,
        segments: GHOST_SEGMENTS,
        decorate: (mesh) => {
          if (state.rockMaps) applyRockMaterial(mesh, state.rockMaps, placement.colorHex, false)
          // Every rock on the track is drawn the same way, or the local one
          // reads as the only one that belongs to the illustration.
          attachRockStroke(
            mesh,
            state.rockConfig?.strokeWidth ?? ROCK_STROKE_WIDTH,
            state.rockConfig?.strokeWobble ?? ROCK_STROKE_WOBBLE,
            state.rockConfig?.strokeColor ?? ROCK_STROKE_COLOR
          )
        }
      }),
    removeGhost: (peerId: string) => removeGhost(ghostRegistry, peerId),
    init,
    destroy
  }
}
