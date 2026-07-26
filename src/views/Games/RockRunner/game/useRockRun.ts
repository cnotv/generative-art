import { ref, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools, getBall } from '@webgamekit/threejs'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents, ControlMapping } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import rockColorUrl from '@/assets/images/textures/rock/Rock016_1K-JPG_Color.webp'
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
import { registerTrackElements, createElementVisibilityHandlers } from '../trackPanel'
import { createLateralFogUniforms } from '../lateralFog'
import {
  advanceDistance,
  forwardImpulseMagnitude,
  isGrounded,
  speedAlong,
  speedCapAt,
  steerDirection,
  steerImpulseMagnitude
} from './rockMotion'
import type {
  CameraMode,
  LateralFogUniforms,
  RockPosPayload,
  ScatterAreaManager,
  TrackChunkManager,
  TrackPath
} from '../types'
import {
  CONTROLS_GAME_ID,
  COUNTDOWN_MS,
  CAMERA_TRANSITION_SECONDS,
  DISTANCE_BROADCAST_MS,
  FIRST_PERSON_HEIGHT,
  FIRST_PERSON_LOOK_AHEAD,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  FOG_SIDE_FAR,
  FOG_SIDE_NEAR,
  FREE_CAM_BACK,
  FREE_CAM_HEIGHT,
  FORWARD_IMPULSE,
  JUMP_COOLDOWN_SECONDS,
  JUMP_IMPULSE,
  KEYBOARD_MAPPING,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  MAX_LATERAL_SPEED,
  ROCK_ANGULAR_DAMPING,
  ROCK_FRICTION,
  ROCK_LINEAR_DAMPING,
  ROCK_RADIUS,
  ROCK_AO_INTENSITY,
  ROCK_DISPLACEMENT_SCALE,
  ROCK_EMISSIVE,
  ROCK_EMISSIVE_INTENSITY,
  ROCK_RESTITUTION,
  ROCK_SEGMENTS,
  ROCK_SPAWN_HEIGHT,
  ROCK_TEXTURE_REPEAT,
  ROCK_WEIGHT,
  SKY_COLOR,
  SPAWN_GATE_SPREAD,
  STEER_IMPULSE,
  WALL_ELEMENT_NAME,
  WALL_HEIGHT,
  WALL_THICKNESS
} from '../config'
import {
  CAMERA_HEIGHT,
  CAMERA_BACK,
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
}

type RunState = {
  rock: ComplexModel | null
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
  jumpCooldown: number
  prevCameraMode: CameraMode
  cameraTransitionElapsed: number
  cameraTransitionStart: THREE.Vector3
  posAccumulator: number
  released: boolean
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
const ZERO_VELOCITY = { x: 0, y: 0, z: 0 }

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
const loadRockMaps = () => {
  const loader = new THREE.TextureLoader()
  const wrap = (url: string, isColor: boolean): THREE.Texture => {
    const texture = loader.load(url)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(ROCK_TEXTURE_REPEAT, ROCK_TEXTURE_REPEAT)
    if (isColor) texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
  return {
    map: wrap(rockColorUrl, true),
    normalMap: wrap(rockNormalUrl, false),
    roughnessMap: wrap(rockRoughnessUrl, false),
    aoMap: wrap(rockAmbientOcclusionUrl, false),
    displacementMap: wrap(rockDisplacementUrl, false)
  }
}

const applyRockMaterial = (rock: ComplexModel): THREE.Texture[] => {
  const mesh = rock as unknown as THREE.Mesh
  const material = mesh.material as THREE.MeshStandardMaterial
  const maps = loadRockMaps()
  material.map = maps.map
  material.normalMap = maps.normalMap
  material.roughnessMap = maps.roughnessMap
  material.aoMap = maps.aoMap
  material.displacementMap = maps.displacementMap
  material.displacementScale = ROCK_DISPLACEMENT_SCALE
  material.displacementBias = -ROCK_DISPLACEMENT_SCALE / 2
  material.aoMapIntensity = ROCK_AO_INTENSITY
  material.emissive = new THREE.Color(ROCK_EMISSIVE)
  material.emissiveIntensity = ROCK_EMISSIVE_INTENSITY
  material.roughness = 1
  material.metalness = 0
  material.needsUpdate = true
  return Object.values(maps)
}

const spawnRock = (
  scene: THREE.Scene,
  world: WorldReference,
  position: CoordinateTuple
): { rock: ComplexModel; textures: THREE.Texture[] } => {
  const rock = getBall(scene, world, {
    name: 'player-rock',
    size: ROCK_RADIUS,
    position,
    restitution: ROCK_RESTITUTION,
    friction: ROCK_FRICTION,
    weight: ROCK_WEIGHT,
    roughness: 1,
    metalness: 0,
    segments: ROCK_SEGMENTS,
    type: 'dynamic'
  }) as unknown as ComplexModel
  rock.userData.body.setLinearDamping(ROCK_LINEAR_DAMPING)
  rock.userData.body.setAngularDamping(ROCK_ANGULAR_DAMPING)
  rock.userData.body.enableCcd(true)
  return { rock, textures: applyRockMaterial(rock) }
}

const buildRunSetupConfig = (spawn: CoordinateTuple) => ({
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

const createRunActions = (
  deps: UseRockRunDeps,
  state: RunState,
  refs: RunReferences,
  getLocalStartTime: () => number
) => {
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

  const applyJump = (delta: number): void => {
    if (!state.rock || !state.controls || !state.path) return
    state.jumpCooldown = Math.max(0, state.jumpCooldown - delta)
    const held = 'jump' in state.controls.currentActions
    const pressed = held && !state.jumpActionHeld
    state.jumpActionHeld = held
    if (!pressed || state.jumpCooldown > 0) return
    const body = state.rock.userData.body
    const groundY = state.path.sampleAt(state.distance).position.y
    if (!isGrounded(body.translation().y, groundY, body.linvel().y)) return
    scratchImpulse.x = 0
    scratchImpulse.y = JUMP_IMPULSE
    scratchImpulse.z = 0
    body.applyImpulse(scratchImpulse, true)
    state.jumpCooldown = JUMP_COOLDOWN_SECONDS
  }

  const applyDrive = (): void => {
    if (!state.rock || !state.controls || !state.path) return
    const sample = state.path.sampleAt(state.distance)
    const body = state.rock.userData.body
    const velocity = body.linvel()
    const forwardMagnitude = forwardImpulseMagnitude(
      speedAlong(velocity, sample.forward),
      speedCapAt(state.distance),
      FORWARD_IMPULSE
    )
    const lateralMagnitude = steerImpulseMagnitude(
      steerDirection(state.controls.currentActions),
      speedAlong(velocity, sample.right),
      MAX_LATERAL_SPEED,
      STEER_IMPULSE
    )
    if (forwardMagnitude === 0 && lateralMagnitude === 0) return
    scratchImpulse.x = sample.forward.x * forwardMagnitude + sample.right.x * lateralMagnitude
    scratchImpulse.y = 0
    scratchImpulse.z = sample.forward.z * forwardMagnitude + sample.right.z * lateralMagnitude
    body.applyImpulse(scratchImpulse, true)
  }

  // The rock is pinned until the countdown clears. Killing its velocity alone
  // would still let gravity build speed up each frame and slide it down the
  // slope it spawned on, so gravity is switched off for the wait and restored
  // exactly once when the run begins.
  const holdAtStart = (): void => {
    if (!state.rock) return
    const body = state.rock.userData.body
    if (state.released) {
      body.setGravityScale(0, true)
      state.released = false
    }
    body.setLinvel(ZERO_VELOCITY, true)
    body.setAngvel(ZERO_VELOCITY, true)
  }

  const release = (): void => {
    if (state.released || !state.rock) return
    state.rock.userData.body.setGravityScale(1, true)
    state.released = true
  }

  const applyInput = (getDelta: () => number): void => {
    handleCameraAction()
    if (!state.rock) return
    if (refs.countdown.value > 0) {
      holdAtStart()
      return
    }
    release()
    updateSmoothedDirection(state.smoothedDirection, state.rock.userData.body.linvel())
    applyJump(getDelta())
    applyDrive()
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

  const pumpWorld = (): void => {
    state.track?.ensureAhead(state.distance)
    state.track?.prune(state.distance)
    state.scatter.forEach((area) => {
      area.ensureAhead(state.distance)
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
      applyRaceCamera({
        mode,
        camera,
        marble: state.rock,
        orbit,
        smoothedDirection: state.smoothedDirection,
        transitionStart: state.cameraTransitionStart,
        transitionAlpha: Math.min(1, state.cameraTransitionElapsed / CAMERA_TRANSITION_SECONDS),
        firstPersonHeight: FIRST_PERSON_HEIGHT,
        firstPersonLookAhead: FIRST_PERSON_LOOK_AHEAD,
        freeCamHeight: FREE_CAM_HEIGHT,
        freeCamBack: FREE_CAM_BACK
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

const buildRunWorld = ({
  tools,
  orbit,
  deps,
  state,
  ghostRegistry,
  pumpWorld
}: WorldParameters): void => {
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
  state.scatter = SCATTER_AREAS.map((definition) =>
    createScatterAreaManager({
      scene,
      path,
      definition,
      lateralFog,
      getConfig: () => scatterPanel.areaConfig(definition.name),
      getTextures: () => scatterPanel.areaTextures(definition.name)
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
  state.disposePanels = [
    registerTrackElements({
      manager: track,
      getDistance: () => state.distance,
      scene,
      lateralFog
    }),
    scatterPanel.teardown
  ]
  scatterPanel.register(state.scatter, () => state.distance)

  const gateCount = Math.max(1, deps.spawnGateCount?.value ?? 1)
  const gateIndex = Math.min(gateCount - 1, Math.max(0, deps.spawnGateIndex?.value ?? 0))
  const spawned = spawnRock(scene, tools.world, spawnPosition(path, gateCount, gateIndex))
  state.rock = spawned.rock
  state.rockTextures = spawned.textures
  pumpWorld()
}

const createRunState = (): RunState => ({
  rock: null,
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
  jumpCooldown: 0,
  prevCameraMode: 'third',
  cameraTransitionElapsed: 0,
  cameraTransitionStart: new THREE.Vector3(),
  posAccumulator: 0,
  released: true,
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
      defineSetup: ({ orbit }) => {
        buildRunWorld({ tools, orbit, deps, state, ghostRegistry, pumpWorld: actions.pumpWorld })
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
    state.rockTextures.forEach((texture) => texture.dispose())
    state.rockTextures = []
    state.rock = null
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
    updateGhostPosition: (placement: GhostPlacement) => placeGhost(ghostRegistry, placement),
    removeGhost: (peerId: string) => removeGhost(ghostRegistry, peerId),
    init,
    destroy
  }
}
