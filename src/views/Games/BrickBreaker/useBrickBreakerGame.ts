import { ref, shallowRef, watch, onUnmounted, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import { getTools, getBall } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls, loadMapping, type ControlsExtras } from '@webgamekit/controls'
import {
  BALL_COLOR,
  BALL_RADIUS,
  BRICK_COLUMN_COUNT,
  BRICK_DEPTH,
  BRICK_HEIGHT,
  BRICK_POOL_SIZE,
  BRICK_ROUGHNESS,
  BRICK_VISUAL_GAP,
  BRICK_WIDTH,
  BRICKS_PER_GARBAGE_ROW,
  CONTROLS_GAME_ID,
  DANGER_ROW,
  FIELD_BOTTOM_Y,
  FIELD_HALF_WIDTH,
  FIELD_TOP_Y,
  FRAME_COLOR,
  FRAME_DEPTH,
  FRAME_THICKNESS,
  GARBAGE_BRICK_COLOR,
  HIGH_SCORE_KEY,
  INITIAL_ROW_COUNT,
  KEYBOARD_MAPPING,
  MAX_FRAME_SECONDS,
  PADDLE_COLOR,
  PADDLE_DEPTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_Y,
  ROW_COLORS,
  SERVE_DELAY_SECONDS,
  SETUP_CONFIG,
  STARTING_LIVES,
  TOUGH_BRICK_COLOR,
  TOUGH_BRICK_HIT_POINTS
} from './config'
import {
  addGarbageRows,
  applyBrickHits,
  ballSpeedForWall,
  brickBounds,
  createWall,
  fitCameraToField,
  reservedBottomFraction,
  garbageRowsToSend,
  hasReachedDangerRow,
  movePaddle,
  scoreForBricks,
  servedBall,
  stepBall
} from './brickBreakerUtilities'
import type { BbGameDeps, BbRunState, Brick } from './types'
import type { MatchStartPayload } from '@/types/seededMatch'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type Tools = UnwrapPromise<ReturnType<typeof getTools>>

type SceneHandles = {
  tools: Tools | null
  controls: ControlsExtras | null
  brickMeshes: THREE.Mesh[]
  ballMesh: THREE.Mesh | null
  paddleMesh: THREE.Mesh | null
  rowMaterials: THREE.MeshStandardMaterial[]
  toughMaterial: THREE.MeshStandardMaterial | null
  garbageMaterial: THREE.MeshStandardMaterial | null
  disposables: Array<THREE.BufferGeometry | THREE.Material>
  projection: THREE.Vector3
}

const createHandles = (): SceneHandles => ({
  tools: null,
  controls: null,
  brickMeshes: [],
  ballMesh: null,
  paddleMesh: null,
  rowMaterials: [],
  toughMaterial: null,
  garbageMaterial: null,
  disposables: [],
  projection: new THREE.Vector3()
})

const createRunState = (payload: MatchStartPayload): BbRunState => ({
  seed: payload.seed,
  startAt: payload.startAt,
  durationMs: payload.durationMs,
  bricks: createWall(payload.seed, INITIAL_ROW_COUNT, BRICK_COLUMN_COUNT, 0),
  ball: null,
  paddle: { x: 0, width: PADDLE_WIDTH },
  serveSeconds: SERVE_DELAY_SECONDS,
  level: 0,
  destroyedCount: 0,
  garbageGeneration: 0,
  pendingGarbageRows: 0,
  elapsedMs: 0,
  isRunning: true
})

const loadHighScore = (): number => {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0)
  } catch {
    return 0
  }
}

const saveHighScore = (score: number): void => {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score))
  } catch {
    // Storage can be unavailable in private windows; the best score is then per session.
  }
}

const matteMaterial = (handles: SceneHandles, color: number): THREE.MeshStandardMaterial => {
  const material = new THREE.MeshStandardMaterial({ color, roughness: BRICK_ROUGHNESS })
  handles.disposables.push(material)
  return material
}

const addBox = (
  handles: SceneHandles,
  scene: THREE.Scene,
  size: [number, number, number],
  material: THREE.Material
): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(...size)
  handles.disposables.push(geometry)
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  return mesh
}

// Each run of the frame ends flush with the outer face of the run it meets, so the corners
// close without a notch or a protruding step.
const buildFrame = (handles: SceneHandles, scene: THREE.Scene): void => {
  const material = matteMaterial(handles, FRAME_COLOR)
  const sideHeight = FIELD_TOP_Y + FRAME_THICKNESS - FIELD_BOTTOM_Y
  const sideCentreY = FIELD_BOTTOM_Y + sideHeight / 2
  const sideCentreX = FIELD_HALF_WIDTH + FRAME_THICKNESS / 2
  addBox(handles, scene, [FRAME_THICKNESS, sideHeight, FRAME_DEPTH], material).position.set(
    -sideCentreX,
    sideCentreY,
    0
  )
  addBox(handles, scene, [FRAME_THICKNESS, sideHeight, FRAME_DEPTH], material).position.set(
    sideCentreX,
    sideCentreY,
    0
  )
  const ceilingLength = FIELD_HALF_WIDTH * 2 + FRAME_THICKNESS * 2
  addBox(handles, scene, [ceilingLength, FRAME_THICKNESS, FRAME_DEPTH], material).position.set(
    0,
    FIELD_TOP_Y + FRAME_THICKNESS / 2,
    0
  )
}

const buildBrickPool = (handles: SceneHandles, scene: THREE.Scene): void => {
  handles.rowMaterials = ROW_COLORS.map((color) => matteMaterial(handles, color))
  handles.toughMaterial = matteMaterial(handles, TOUGH_BRICK_COLOR)
  handles.garbageMaterial = matteMaterial(handles, GARBAGE_BRICK_COLOR)
  const geometry = new THREE.BoxGeometry(
    BRICK_WIDTH - BRICK_VISUAL_GAP,
    BRICK_HEIGHT - BRICK_VISUAL_GAP,
    BRICK_DEPTH
  )
  handles.disposables.push(geometry)
  handles.brickMeshes = Array.from({ length: BRICK_POOL_SIZE }, () => {
    const mesh = new THREE.Mesh(geometry, handles.rowMaterials[0])
    mesh.visible = false
    scene.add(mesh)
    return mesh
  })
}

const materialForBrick = (handles: SceneHandles, brick: Brick): THREE.Material => {
  if (brick.kind === 'garbage' && handles.garbageMaterial) return handles.garbageMaterial
  if (brick.hitPoints >= TOUGH_BRICK_HIT_POINTS && handles.toughMaterial) {
    return handles.toughMaterial
  }
  return handles.rowMaterials[brick.colorIndex]
}

const syncBrickMeshes = (handles: SceneHandles, bricks: Brick[]): void => {
  handles.brickMeshes.forEach((mesh, index) => {
    const brick = bricks[index]
    mesh.visible = Boolean(brick)
    if (!brick) return
    const bounds = brickBounds(brick)
    mesh.position.set((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0)
    mesh.material = materialForBrick(handles, brick)
  })
}

const buildScene = (handles: SceneHandles, scene: THREE.Scene): void => {
  buildFrame(handles, scene)
  buildBrickPool(handles, scene)
  handles.paddleMesh = addBox(
    handles,
    scene,
    [PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_DEPTH],
    matteMaterial(handles, PADDLE_COLOR)
  )
  handles.paddleMesh.position.set(0, PADDLE_Y, 0)
  handles.ballMesh = getBall(scene, undefined, {
    size: BALL_RADIUS,
    color: BALL_COLOR,
    segments: 24
  })
}

const screenPercent = (handles: SceneHandles, x: number, y: number) => {
  if (!handles.tools) return { xPercent: 50, yPercent: 50 }
  handles.projection.set(x, y, 0).project(handles.tools.camera)
  return {
    xPercent: ((handles.projection.x + 1) / 2) * 100,
    yPercent: ((1 - handles.projection.y) / 2) * 100
  }
}

// The shared resize handler measures the canvas, which the renderer has already pinned to its
// old pixel size, so the canvas never grows after a phone rotates. Sizing from the container
// fixes that.
const fitSceneToContainer = (handles: SceneHandles, touchButtonBandPx: number): void => {
  if (!handles.tools) return
  const { camera, renderer } = handles.tools
  const container = renderer.domElement.parentElement ?? renderer.domElement
  const { clientWidth, clientHeight } = container
  if (clientWidth === 0 || clientHeight === 0) return
  renderer.setSize(clientWidth, clientHeight)
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
  const reservedFraction = reservedBottomFraction(clientWidth, clientHeight, touchButtonBandPx)
  const { position, lookAt } = fitCameraToField(camera.aspect, reservedFraction)
  camera.position.set(...position)
  camera.lookAt(...lookAt)
}

const controlDirection = (controls: ControlsExtras | null): number => {
  if (!controls) return 0
  const actions = controls.currentActions
  return ('right' in actions ? 1 : 0) - ('left' in actions ? 1 : 0)
}

type RunHud = {
  score: Ref<number>
  lives: Ref<number>
  highScore: Ref<number>
  countdownSeconds: Ref<number>
  remainingSeconds: Ref<number | null>
  isOver: Ref<boolean>
}

type RunContext = {
  handles: SceneHandles
  run: ShallowRef<BbRunState | null>
  hud: RunHud
  deps: BbGameDeps
}

const endRun = (context: RunContext, isEliminated: boolean): void => {
  const { run, hud, deps } = context
  if (!run.value?.isRunning) return
  run.value.isRunning = false
  hud.isOver.value = true
  if (hud.score.value > hud.highScore.value) {
    hud.highScore.value = hud.score.value
    saveHighScore(hud.score.value)
  }
  deps.onEnd(hud.score.value, isEliminated)
}

const applyPendingGarbage = (context: RunContext, state: BbRunState): void => {
  if (state.pendingGarbageRows === 0) return
  state.bricks = addGarbageRows(
    state.bricks,
    state.pendingGarbageRows,
    BRICK_COLUMN_COUNT,
    state.seed,
    state.garbageGeneration
  )
  state.garbageGeneration += 1
  state.pendingGarbageRows = 0
  syncBrickMeshes(context.handles, state.bricks)
  if (hasReachedDangerRow(state.bricks, DANGER_ROW)) endRun(context, true)
}

const awardPoints = (context: RunContext, destroyedBricks: Brick[], firstHit: Brick): void => {
  const points = scoreForBricks(destroyedBricks)
  if (points === 0) return
  context.hud.score.value += points
  const bounds = brickBounds(firstHit)
  const position = screenPercent(context.handles, (bounds.minX + bounds.maxX) / 2, bounds.maxY)
  context.deps.onScore(context.hud.score.value, { points, ...position })
}

const handleHits = (context: RunContext, state: BbRunState, hitBrickIds: string[]): void => {
  const firstHit = state.bricks.find((brick) => hitBrickIds.includes(brick.id))
  const { bricks, destroyedBricks } = applyBrickHits(state.bricks, hitBrickIds)
  const rows = garbageRowsToSend(
    state.destroyedCount,
    state.destroyedCount + destroyedBricks.length,
    BRICKS_PER_GARBAGE_ROW
  )
  state.bricks = bricks
  state.destroyedCount += destroyedBricks.length
  if (firstHit) awardPoints(context, destroyedBricks, firstHit)
  if (rows > 0 && !context.deps.isSolo.value) context.deps.onGarbageSent(rows)
  if (state.bricks.length === 0) {
    state.level += 1
    state.bricks = createWall(state.seed, INITIAL_ROW_COUNT, BRICK_COLUMN_COUNT, state.level)
  }
  syncBrickMeshes(context.handles, state.bricks)
}

const advanceBall = (context: RunContext, state: BbRunState, deltaSeconds: number): void => {
  if (!state.ball) {
    state.serveSeconds -= deltaSeconds
    if (state.serveSeconds <= 0) {
      state.ball = servedBall(state.paddle, ballSpeedForWall(state.level))
    }
    return
  }
  const step = stepBall(state.ball, deltaSeconds, state.paddle, state.bricks)
  state.ball = step.ball
  if (step.hitBrickIds.length > 0) handleHits(context, state, step.hitBrickIds)
  if (!step.isLost) return
  state.ball = null
  state.serveSeconds = SERVE_DELAY_SECONDS
  context.hud.lives.value -= 1
  if (context.hud.lives.value <= 0) endRun(context, true)
}

// Returns whether the run should advance this frame: not before the shared start time, and
// not after a sprint's clock has run out.
const updateClock = (context: RunContext, state: BbRunState, deltaSeconds: number): boolean => {
  const untilStart = state.startAt - Date.now()
  context.hud.countdownSeconds.value = Math.max(0, Math.ceil(untilStart / 1000))
  if (untilStart > 0) return false
  state.elapsedMs += deltaSeconds * 1000
  if (state.durationMs === null) return true
  const remainingMs = Math.max(0, state.durationMs - state.elapsedMs)
  context.hud.remainingSeconds.value = Math.ceil(remainingMs / 1000)
  if (remainingMs === 0) endRun(context, false)
  return remainingMs > 0
}

const syncMovingMeshes = (handles: SceneHandles, state: BbRunState): void => {
  handles.paddleMesh?.position.setX(state.paddle.x)
  const ballX = state.ball?.x ?? state.paddle.x
  const ballY = state.ball?.y ?? PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS
  handles.ballMesh?.position.set(ballX, ballY, 0)
}

const tickRun = (context: RunContext): void => {
  const state = context.run.value
  const { handles } = context
  if (!state?.isRunning || !handles.tools) return
  const deltaSeconds = Math.min(handles.tools.getDelta(), MAX_FRAME_SECONDS)
  if (!updateClock(context, state, deltaSeconds)) return
  state.paddle = movePaddle(state.paddle, controlDirection(handles.controls), deltaSeconds)
  applyPendingGarbage(context, state)
  if (state.isRunning) advanceBall(context, state, deltaSeconds)
  syncMovingMeshes(handles, state)
}

/**
 * Three.js scene and game loop for one player's brick breaker run. The run is driven entirely
 * by the match seed: walls, garbage gaps and serves come out the same on every peer.
 * @param deps - Canvas, solo flag and the callbacks for score, garbage and the end of the run
 * @returns HUD state and the controls to start, finish and feed garbage into a run
 */
export const useBrickBreakerGame = (deps: BbGameDeps) => {
  const handles = createHandles()
  const run = shallowRef<BbRunState | null>(null)
  const hud: RunHud = {
    score: ref(0),
    lives: ref(STARTING_LIVES),
    highScore: ref(loadHighScore()),
    countdownSeconds: ref(0),
    remainingSeconds: ref<number | null>(null),
    isOver: ref(false)
  }
  const context: RunContext = { handles, run, hud, deps }
  const currentActions = ref<Record<string, unknown>>({})
  const reframe = (): void => fitSceneToContainer(handles, deps.touchButtonBandPx)

  const destroy = (): void => {
    window.removeEventListener('resize', reframe)
    handles.controls?.destroyControls()
    handles.tools?.cleanup()
    handles.disposables.forEach((disposable) => disposable.dispose())
    Object.assign(handles, createHandles())
    run.value = null
  }

  const start = async (payload: MatchStartPayload): Promise<void> => {
    destroy()
    if (!deps.canvas.value) return
    run.value = createRunState(payload)
    hud.score.value = 0
    hud.lives.value = STARTING_LIVES
    hud.isOver.value = false
    hud.remainingSeconds.value = payload.durationMs === null ? null : payload.durationMs / 1000
    handles.controls = createControls({
      mapping: loadMapping(CONTROLS_GAME_ID) ?? KEYBOARD_MAPPING
    })
    currentActions.value = handles.controls.currentActions as unknown as Record<string, unknown>
    const tools = await getTools({ canvas: deps.canvas.value })
    handles.tools = tools
    await tools.setup({
      config: SETUP_CONFIG,
      defineSetup: () => buildScene(handles, tools.scene)
    })
    reframe()
    window.addEventListener('resize', reframe)
    if (run.value) {
      syncBrickMeshes(handles, run.value.bricks)
      syncMovingMeshes(handles, run.value)
    }
    const timeline = createTimelineManager()
    timeline.addAction({
      name: 'brick-breaker-step',
      category: 'game',
      start: 0,
      action: () => tickRun(context)
    })
    tools.animate({ timeline })
  }

  const receiveGarbage = (rows: number): void => {
    if (run.value?.isRunning) run.value.pendingGarbageRows += rows
  }

  const finish = (): void => endRun(context, false)

  watch(
    () => deps.canvas.value,
    (canvas) => {
      if (!canvas) destroy()
    }
  )
  onUnmounted(destroy)

  return {
    ...hud,
    currentActions,
    start,
    finish,
    receiveGarbage,
    destroy
  }
}
