import { ref, watch, type Ref, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import * as THREE from 'three'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsCurrents } from '@webgamekit/controls'
import { activeRendererReference } from '@webgamekit/threejs'
import type { OnProgress } from '@webgamekit/threejs'
import { useSceneViewStore } from '@/stores/sceneView'
import { useMinigolfStore } from '@/stores/minigolf'
import { buildGround, buildWalls, buildHoleMarker } from './helpers/course'
import {
  createBall,
  syncBall,
  shootBall,
  isBallStopped,
  resetBall,
  freezeBall,
  spawnConfetti,
  stepConfetti,
  type BallState,
  type ConfettiParticle
} from './helpers/ball'
import { createAimState, beginDrag, updateDrag, endDrag } from './helpers/input'
import { classifyScore, type ScoreType } from './helpers/score'
import {
  BALL_RADIUS,
  CAMERA_OFFSET_TOPDOWN,
  CAMERA_FIT_PADDING,
  MAX_SHOT_POWER,
  MAX_STROKES,
  AIM_LINE_MAX_LENGTH,
  CONFETTI_LIFETIME,
  WALL_HEIGHT,
  WALL_THICKNESS,
  GAMEPAD_MAPPING,
  CONTROLS_GAME_ID,
  GAMEPAD_AIM_SPEED,
  GAMEPAD_CHARGE_SPEED,
  GAMEPAD_AIM_PREVIEW_POWER,
  type HoleConfig
} from './config'
import type { useMinigolfSession } from './useMinigolfSession'

type RigidBody = import('@dimforge/rapier3d-compat').default.RigidBody
type World = import('@dimforge/rapier3d-compat').default.World

type GameContext = {
  scene: THREE.Scene
  camera: THREE.Camera
  world: World
  getBall: () => BallState | null
  setBall: (b: BallState) => void
  aim: ReturnType<typeof createAimState>
  holeBodies: RigidBody[]
  confetti: ConfettiParticle[]
}

type GameState = {
  message: Ref<string>
  scoreLabel: Ref<string | null>
  scoreType: Ref<ScoreType | null>
  waiting: Ref<boolean>
  aimPower: Ref<number>
  isAiming: Ref<boolean>
  localStrokes: Ref<number>
}

type SessionDep = Pick<
  ReturnType<typeof useMinigolfSession>,
  'broadcastBallPosition' | 'broadcastScore' | 'broadcastAdvanceHole' | 'localPeerId'
>

type GameDeps = {
  state: GameState
  store: ReturnType<typeof useMinigolfStore>
  activeHoles: ComputedRef<HoleConfig[]>
  session: SessionDep
  canvas: Ref<HTMLCanvasElement | null>
}

type PointerDeps = {
  state: GameState
  orbitReference: Ref<{ enabled: boolean } | null | undefined>
  canvas: Ref<HTMLCanvasElement | null>
}

const SCENE_LIGHTS = {
  directional: {
    shadow: {
      mapSize: { width: 4096, height: 4096 },
      bias: -0.0005,
      radius: 0,
      camera: { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 50 }
    }
  }
}

const AIM_DASH_COUNT = 8
const AIM_DASH_RADIUS = 0.09

const onPlayAgainPressedHolder = { current: null as (() => void) | null }

export const setOnPlayAgainPressed = (callback: (() => void) | null): void => {
  onPlayAgainPressedHolder.current = callback
}

const clearGameState = (state: GameState): void => {
  state.message.value = ''
  state.scoreLabel.value = null
  state.scoreType.value = null
  state.waiting.value = false
  state.aimPower.value = 0
  state.isAiming.value = false
  state.localStrokes.value = 0
}

const safeRemoveBody = (body: RigidBody, world: World): void => {
  try {
    world.removeRigidBody(body)
  } catch {
    /* already removed */
  }
}

const tagHoleObject = (object: THREE.Object3D): void => {
  object.userData.mgHole = true
}

const clearHoleObjects = (ctx: GameContext): void => {
  ctx.scene.children.filter((c) => c.userData.mgHole).forEach((c) => ctx.scene.remove(c))
  ctx.holeBodies.forEach((body) => safeRemoveBody(body, ctx.world))
  ctx.holeBodies.length = 0
  ctx.confetti.length = 0
  const ball = ctx.getBall()
  if (ball) safeRemoveBody(ball.body, ctx.world)
}

const fitCamera = (
  camera: THREE.Camera,
  ground: { width: number; depth: number },
  canvasElement: HTMLCanvasElement | null
): void => {
  if (!('fov' in camera)) return
  const perspCamera = camera as THREE.PerspectiveCamera
  const aspect =
    canvasElement && canvasElement.clientWidth > 0 && canvasElement.clientHeight > 0
      ? canvasElement.clientWidth / canvasElement.clientHeight
      : perspCamera.aspect
  perspCamera.aspect = aspect
  const halfFovRad = (perspCamera.fov * Math.PI) / 360
  const halfWidth = ground.width / 2 + WALL_THICKNESS + CAMERA_FIT_PADDING
  const halfDepth = ground.depth / 2 + WALL_THICKNESS + CAMERA_FIT_PADDING
  const heightForDepth = halfDepth / Math.tan(halfFovRad)
  const heightForWidth = halfWidth / (aspect * Math.tan(halfFovRad))
  camera.position.y = Math.max(heightForDepth, heightForWidth)
  perspCamera.updateProjectionMatrix()
}

const buildHole = (ctx: GameContext, deps: GameDeps): void => {
  const { state, store, activeHoles, canvas } = deps
  clearHoleObjects(ctx)
  const hole = activeHoles.value[store.currentHole]
  const midX = (hole.teePosition[0] + hole.holePosition[0]) / 2
  const midZ = (hole.teePosition[2] + hole.holePosition[2]) / 2
  ctx.camera.position.set(
    midX + CAMERA_OFFSET_TOPDOWN[0],
    CAMERA_OFFSET_TOPDOWN[1],
    midZ + CAMERA_OFFSET_TOPDOWN[2]
  )
  fitCamera(ctx.camera, hole.ground, canvas.value)
  ctx.camera.up.set(0, 0, -1)
  ctx.camera.lookAt(midX, 0, midZ)
  const { meshes: groundMeshes, bodies: groundBodies } = buildGround(hole, ctx.scene, ctx.world)
  groundMeshes.forEach(tagHoleObject)
  groundBodies.forEach((b) => ctx.holeBodies.push(b))
  const { meshes: wallMeshes, bodies: wallBodies } = buildWalls(hole, ctx.scene, ctx.world)
  wallMeshes.forEach(tagHoleObject)
  wallBodies.forEach((b) => ctx.holeBodies.push(b))
  tagHoleObject(buildHoleMarker(hole.holePosition, ctx.scene))
  const ball = createBall(hole.teePosition, ctx.scene, ctx.world)
  tagHoleObject(ball.mesh)
  ctx.setBall(ball)
  ctx.aim.direction.set(0, 0, -1)
  state.message.value = ''
  state.scoreLabel.value = null
  state.scoreType.value = null
  state.waiting.value = false
  state.localStrokes.value = 0
}

const resolveTurn = (deps: GameDeps, holed = false): void => {
  const { state, store, activeHoles, session } = deps
  const finalStrokes = holed ? state.localStrokes.value : MAX_STROKES
  state.waiting.value = true
  const par = activeHoles.value[store.currentHole].par
  if (holed) {
    const score = classifyScore(finalStrokes, par)
    state.scoreType.value = score.type
    state.scoreLabel.value = score.label
    state.message.value = `${finalStrokes} stroke${finalStrokes !== 1 ? 's' : ''} (Par ${par})`
  } else {
    state.scoreType.value = null
    state.scoreLabel.value = null
    state.message.value = 'Max strokes — waiting…'
  }
  session.broadcastScore(store.currentHole, finalStrokes)
}

const checkHoleEntry = (ballState: BallState, ctx: GameContext, deps: GameDeps): void => {
  const { state, activeHoles, store } = deps
  if (ballState.mesh.position.y < -BALL_RADIUS) {
    freezeBall(ballState)
    const hp = activeHoles.value[store.currentHole].holePosition
    ctx.confetti = spawnConfetti(ctx.scene, hp[0], hp[2])
    resolveTurn(deps, true)
    return
  }
  if (isBallStopped(ballState) && state.localStrokes.value >= MAX_STROKES) resolveTurn(deps)
}

const runFrame = (ballState: BallState, ctx: GameContext, deps: GameDeps): void => {
  const { state, store, activeHoles } = deps
  ctx.confetti = stepConfetti(ctx.confetti, ctx.scene, CONFETTI_LIFETIME)
  syncBall(ballState)
  const vel = ballState.body.linvel()
  const speed = Math.hypot(vel.x, vel.y, vel.z)
  if (speed > 0.01 && speed < 1.5) {
    ballState.body.setLinvel({ x: vel.x * 0.88, y: vel.y, z: vel.z * 0.88 }, false)
  }
  if (ballState.mesh.position.y > WALL_HEIGHT + 1) {
    resetBall(ballState, activeHoles.value[store.currentHole].teePosition)
    return
  }
  if (!state.waiting.value && state.localStrokes.value > 0) checkHoleEntry(ballState, ctx, deps)
}

const createAimDots = (scene: THREE.Scene): THREE.Mesh[] => {
  const geo = new THREE.SphereGeometry(AIM_DASH_RADIUS, 8, 8)
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff })
  return Array.from({ length: AIM_DASH_COUNT }, () => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.visible = false
    scene.add(mesh)
    return mesh
  })
}

/**
 * Show a single dash dot ahead of the ball along the aim direction, matching
 * the regular aim-dash size, hiding the rest — used for the gamepad's aim preview.
 * @param dots Aim preview dot meshes
 * @param ball Ball state to anchor the indicator to
 * @param direction Current aim direction
 * @param distance Distance ahead of the ball to place the indicator
 */
const updateAimPreviewDot = (
  dots: THREE.Mesh[],
  ball: BallState,
  direction: THREE.Vector3,
  distance: number
): void => {
  const origin = ball.mesh.position
  dots.forEach((dot, index) => {
    dot.visible = index === 0
    if (index !== 0) return
    dot.position.set(
      origin.x + direction.x * distance,
      origin.y + AIM_DASH_RADIUS,
      origin.z + direction.z * distance
    )
  })
}

const updateAimDots = (
  dots: THREE.Mesh[],
  ball: BallState,
  direction: THREE.Vector3,
  power: number
): void => {
  const length = power * AIM_LINE_MAX_LENGTH
  const step = length / (AIM_DASH_COUNT + 1)
  const origin = ball.mesh.position
  dots.forEach((dot, index) => {
    dot.scale.setScalar(1)
    const t = step * (index + 1)
    dot.position.set(
      origin.x + direction.x * t,
      origin.y + AIM_DASH_RADIUS,
      origin.z + direction.z * t
    )
  })
}

const createGhostBallSync = (
  scene: THREE.Scene,
  ghostGeo: THREE.SphereGeometry,
  store: ReturnType<typeof useMinigolfStore>,
  localPeerId: Ref<string>
): (() => void) => {
  const ghostMeshes: Record<string, THREE.Mesh> = {}
  return () => {
    const positions = store.remoteBallPositions
    Object.keys(positions).forEach((peerId) => {
      if (peerId === localPeerId.value) return
      const player = store.players[peerId]
      if (!player) return
      const pos = positions[peerId]
      if (!ghostMeshes[peerId]) {
        const mat = new THREE.MeshToonMaterial({
          color: new THREE.Color(player.color),
          transparent: true,
          opacity: 0.45
        })
        ghostMeshes[peerId] = new THREE.Mesh(ghostGeo, mat)
        scene.add(ghostMeshes[peerId])
      }
      ghostMeshes[peerId].position.set(pos.x, pos.y, pos.z)
    })
  }
}

const GAMEPAD_AIM_AXIS = new THREE.Vector3(0, 1, 0)

type GamepadAimResult = { fire: boolean; power: number }

/**
 * Build a per-frame stepper that drives aiming/shooting from gamepad actions:
 * the left stick rotates the aim direction and the fire button charges power
 * on hold, releasing it as a shot — mirroring the pointer drag-to-aim gesture.
 * @param aim AimState shared with pointer input
 * @param aimDots Aim preview dot meshes
 * @param getBall Accessor for the current ball
 * @param state Reactive game state
 * @returns Stepper invoked each frame with current actions and frame delta
 */
const createGamepadAimStepper = (
  aim: ReturnType<typeof createAimState>,
  aimDots: THREE.Mesh[],
  getBall: () => BallState | null,
  state: GameState
): ((currentActions: ControlsCurrents, delta: number) => GamepadAimResult) => {
  let charging = false
  let hasRotated = false
  return (currentActions, delta) => {
    const ball = getBall()
    if (aim.dragging) return { fire: false, power: 0 }
    if (state.waiting.value || !ball || !isBallStopped(ball)) {
      hasRotated = false
      aimDots.forEach((d) => {
        d.visible = false
      })
      return { fire: false, power: 0 }
    }

    const rotatingLeft = 'aim-left' in currentActions
    const rotatingRight = 'aim-right' in currentActions
    if (rotatingLeft) aim.direction.applyAxisAngle(GAMEPAD_AIM_AXIS, -GAMEPAD_AIM_SPEED * delta)
    if (rotatingRight) aim.direction.applyAxisAngle(GAMEPAD_AIM_AXIS, GAMEPAD_AIM_SPEED * delta)
    if (rotatingLeft || rotatingRight) hasRotated = true

    if ('fire' in currentActions) {
      charging = true
      aim.power = Math.min(aim.power + GAMEPAD_CHARGE_SPEED * delta, 1)
      state.isAiming.value = true
      state.aimPower.value = Math.round(aim.power * 100)
      updateAimDots(aimDots, ball, aim.direction, aim.power)
      aimDots.forEach((d) => {
        d.visible = true
      })
      return { fire: false, power: 0 }
    }

    if (charging) {
      charging = false
      const power = aim.power
      aim.power = 0
      state.isAiming.value = false
      state.aimPower.value = 0
      return { fire: power > 0, power }
    }

    if (hasRotated) {
      updateAimPreviewDot(
        aimDots,
        ball,
        aim.direction,
        GAMEPAD_AIM_PREVIEW_POWER * AIM_LINE_MAX_LENGTH
      )
    } else {
      aimDots.forEach((d) => {
        d.visible = false
      })
    }
    return { fire: false, power: 0 }
  }
}

/**
 * Apply a gamepad aim-stepper result: fires the shot and counts the stroke
 * when the fire button was released with charge and strokes remain.
 * @param result Stepper result for this frame
 * @param ball Ball to shoot
 * @param aim Shared aim state holding the current direction
 * @param state Reactive game state
 */
const applyGamepadFire = (
  result: GamepadAimResult,
  ball: BallState,
  aim: ReturnType<typeof createAimState>,
  state: GameState
): void => {
  if (!result.fire || state.localStrokes.value >= MAX_STROKES) return
  state.localStrokes.value++
  shootBall(ball, aim.direction, result.power, MAX_SHOT_POWER)
}

const bindPointerEvents = (
  aim: ReturnType<typeof createAimState>,
  camera: THREE.Camera,
  aimDots: THREE.Mesh[],
  getBall: () => BallState | null,
  pdeps: PointerDeps
): (() => void) => {
  const { state, orbitReference, canvas } = pdeps
  const onPointerDown = (e: PointerEvent): void => {
    const ball = getBall()
    if (state.waiting.value || !ball || !isBallStopped(ball) || orbitReference.value?.enabled)
      return
    beginDrag(aim, e.clientX, e.clientY)
    state.isAiming.value = true
  }
  const onPointerMove = (e: PointerEvent): void => {
    const ball = getBall()
    if (!aim.dragging || !ball) return
    updateDrag(aim, e.clientX, e.clientY, camera, ball.mesh.position)
    state.aimPower.value = Math.round(aim.power * 100)
    updateAimDots(aimDots, ball, aim.direction, aim.power)
    aimDots.forEach((d) => {
      d.visible = true
    })
  }
  const onPointerUp = (e: PointerEvent): void => {
    const ball = getBall()
    if (!aim.dragging || !ball) return
    updateDrag(aim, e.clientX, e.clientY, camera, ball.mesh.position)
    aimDots.forEach((d) => {
      d.visible = false
    })
    state.isAiming.value = false
    state.aimPower.value = 0
    if (!endDrag(aim) || state.localStrokes.value >= MAX_STROKES) return
    state.localStrokes.value++
    shootBall(ball, aim.direction, aim.power, MAX_SHOT_POWER)
  }
  canvas.value!.addEventListener('pointerdown', onPointerDown)
  canvas.value!.addEventListener('pointermove', onPointerMove)
  canvas.value!.addEventListener('pointerup', onPointerUp)
  return () => {
    canvas.value?.removeEventListener('pointerdown', onPointerDown)
    canvas.value?.removeEventListener('pointermove', onPointerMove)
    canvas.value?.removeEventListener('pointerup', onPointerUp)
  }
}

type SceneSetupArguments = Parameters<
  Parameters<ReturnType<typeof useSceneViewStore>['init']>[2]['defineSetup'] extends (
    a: infer A
  ) => void
    ? (a: A) => void
    : never
>[0]

const refitHole = (ctx: GameContext, hole: HoleConfig, canvasElement: HTMLCanvasElement): void => {
  const midX = (hole.teePosition[0] + hole.holePosition[0]) / 2
  const midZ = (hole.teePosition[2] + hole.holePosition[2]) / 2
  canvasElement.style.removeProperty('width')
  canvasElement.style.removeProperty('height')
  const w = canvasElement.clientWidth
  const h = canvasElement.clientHeight
  if (w > 0 && h > 0) {
    activeRendererReference.current?.setSize(w, h, false)
  }
  fitCamera(ctx.camera, hole.ground, canvasElement)
  ctx.camera.lookAt(midX, 0, midZ)
}

/**
 * Manage the Minigolf Three.js/Rapier game scene: hole building, ball physics, aim, confetti.
 * @param canvas - Ref to the canvas element for scene initialisation.
 * @param session - Session methods for broadcasting ball position and score.
 * @param activeHoles - Computed list of holes to play through.
 * @returns Reactive game state and lifecycle controls.
 */
export const useMinigolfGame = (
  canvas: Ref<HTMLCanvasElement | null>,
  session: SessionDep,
  activeHoles: ComputedRef<HoleConfig[]>,
  onProgress?: OnProgress
) => {
  const store = useMinigolfStore()
  const sceneStore = useSceneViewStore()
  const { orbitReference } = storeToRefs(sceneStore)

  const state: GameState = {
    message: ref(''),
    scoreLabel: ref(null),
    scoreType: ref(null),
    waiting: ref(false),
    aimPower: ref(0),
    isAiming: ref(false),
    localStrokes: ref(0)
  }

  let gameContext: GameContext | null = null
  let cleanupListeners: (() => void) | null = null
  let canvasResizeObserver: ResizeObserver | null = null
  let gamepadControls: ReturnType<typeof createControls> | null = null

  const refitCurrentHole = (ctx: GameContext): void => {
    const hole = activeHoles.value[store.currentHole]
    if (!hole || !canvas.value) return
    refitHole(ctx, hole, canvas.value)
  }

  const setupGameScene = ({
    scene,
    camera,
    world,
    animate,
    getDelta
  }: SceneSetupArguments): void => {
    let ballState: BallState | null = null
    const aim = createAimState()
    const ctx: GameContext = {
      scene,
      camera,
      world,
      aim,
      holeBodies: [],
      confetti: [],
      getBall: () => ballState,
      setBall: (b) => {
        ballState = b
      }
    }
    const deps: GameDeps = { state, store, activeHoles, session, canvas }
    gameContext = ctx
    buildHole(ctx, deps)
    refitCurrentHole(ctx)
    if (canvas.value) {
      canvasResizeObserver = new ResizeObserver(() => refitCurrentHole(ctx))
      canvasResizeObserver.observe(canvas.value)
    }
    const aimDots = createAimDots(scene)
    const ghostGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 12)
    const syncGhostBalls = createGhostBallSync(scene, ghostGeo, store, session.localPeerId)
    cleanupListeners = bindPointerEvents(aim, camera, aimDots, () => ballState, {
      state,
      orbitReference,
      canvas
    })
    const stepGamepadAim = createGamepadAimStepper(aim, aimDots, () => ballState, state)
    gamepadControls = createControls({
      mapping: loadMapping(CONTROLS_GAME_ID) ?? GAMEPAD_MAPPING,
      keyboard: false,
      touch: false,
      mouse: false
    })
    let summaryFireLast = false
    animate({
      timeline: createTimelineManager(),
      beforeTimeline: () => {
        if (gameContext !== ctx) return
        syncGhostBalls()
        const summaryFire =
          store.phase === 'summary' && !!gamepadControls && 'fire' in gamepadControls.currentActions
        if (summaryFire && !summaryFireLast) onPlayAgainPressedHolder.current?.()
        summaryFireLast = summaryFire
        if (!ballState || !gamepadControls) return
        applyGamepadFire(
          stepGamepadAim(gamepadControls.currentActions, getDelta()),
          ballState,
          aim,
          state
        )
        const pos = ballState.mesh.position
        session.broadcastBallPosition(pos.x, pos.y, pos.z)
        runFrame(ballState, ctx, deps)
      }
    })
  }

  /**
   * Initialise the Three.js scene and start the game round.
   * @returns Promise that resolves when the scene is ready.
   */
  const startGame = async (): Promise<void> => {
    if (!canvas.value) return
    store.playerList
      .map((p) => ({ ...p, scores: [] as number[] }))
      .forEach((p) => store.upsertPlayer(p))
    state.localStrokes.value = 0
    await sceneStore.init(
      canvas.value,
      { ground: false, sky: false, orbit: { disabled: true }, lights: SCENE_LIGHTS },
      {
        playMode: true,
        viewPanels: { showElements: false },
        defineSetup: setupGameScene,
        onProgress
      }
    )
  }

  /**
   * Tear down the scene and reset local game state.
   */
  const cleanup = (): void => {
    cleanupListeners?.()
    cleanupListeners = null
    canvasResizeObserver?.disconnect()
    canvasResizeObserver = null
    gamepadControls?.destroyControls()
    gamepadControls = null
    sceneStore.cleanup()
    gameContext = null
    clearGameState(state)
  }

  watch(
    () => store.currentHole,
    (next, previous) => {
      if (next === previous || !gameContext || store.phase !== 'playing') return
      clearGameState(state)
      buildHole(gameContext, { state, store, activeHoles, session, canvas })
    }
  )

  return { ...state, startGame, cleanup }
}
