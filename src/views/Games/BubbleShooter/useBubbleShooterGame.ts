import { ref, onUnmounted } from 'vue'
import * as THREE from 'three'
import { createSound } from '@webgamekit/audio'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsCurrents } from '@webgamekit/controls'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import type { Timeline } from '@webgamekit/animation'
import {
  GRID_COLS,
  BUBBLE_RADIUS,
  BUBBLE_DIAMETER,
  GRID_TOP_Y,
  SHOOTER_X,
  SHOOTER_Y,
  FIRE_LINE_Y,
  BUBBLE_SPEED,
  SPEED_ROW_DROP_MS,
  GARBAGE_THRESHOLD,
  WALL_LEFT,
  WALL_RIGHT,
  HEX_ROW_HEIGHT,
  COLOR_HEX,
  GAMEPAD_MAPPING,
  CONTROLS_GAME_ID,
  GAME_OVER_DELAY_MS,
  WATER_RISE_DURATION_MS,
  MATCH_POINTS_PER_BUBBLE,
  COMBO_POINTS_PER_BUBBLE,
  type BubbleColor
} from './config'
import {
  createGrid,
  cellToWorld,
  averageCellPosition,
  findMatch,
  findDangling,
  snapToCell,
  trajectoryPoints,
  pickNextColor,
  hasReachedFireLine,
  addGarbageRows,
  addTopRows,
  stepGamepadAimAngle
} from './bubbleShooterUtilities'
import type { GameDeps, BsGameContext } from './types'

export type { GameDeps }

const CAMERA_Z = 22
const CAMERA_FOV = 65
const WALL_THICKNESS = 0.3
const WALL_TOP_Y = GRID_TOP_Y + BUBBLE_RADIUS
const WALL_BOTTOM_Y = SHOOTER_Y - 1.5
const GAME_CENTER_Y = (WALL_TOP_Y + WALL_BOTTOM_Y) / 2
const GAME_HEIGHT = WALL_TOP_Y - WALL_BOTTOM_Y
const GAME_WIDTH = WALL_RIGHT - WALL_LEFT + WALL_THICKNESS + 1.0
const CAMERA_FIT_MARGIN = 1.08
const RAD_TO_DEG = 180 / Math.PI
const CAMERA_Y = GAME_CENTER_Y
const AIM_MIN_ANGLE = -(Math.PI * 0.45)
const AIM_MAX_ANGLE = Math.PI * 0.45
// Matches the z=0 raycast plane in computeAimAngle and the in-flight bubble's
// z position, so the aim preview lines up exactly with the pointer.
const TRAJECTORY_Z = 0
const TRAJECTORY_DOT_COUNT = 10
const TRAJECTORY_DOT_RADIUS = 0.09
const TRAJECTORY_DOT_SPACING = 1 / TRAJECTORY_DOT_COUNT
const TRAJECTORY_DOT_SPEED = 0.09
const TRAJECTORY_DOT_FADE_DISTANCE = 0.3
const SHOOTER_HEIGHT = 0.6
const SHOOTER_BASE_RADIUS = 0.3
const WALL_DEPTH = 0.5
const FIRE_LINE_HEIGHT = 0.08
const PREVIEW_SCALE = 0.7
const PREVIEW_OFFSET_X = 1.5
const POP_PARTICLE_COUNT = 6
const POP_LIFETIME = 0.35
const POP_SPEED = 3.5
const SHAKE_THRESHOLD_MS = 4000
const SHAKE_AMPLITUDE = 0.08
const SHAKE_FREQUENCY = 8
const DROP_ANIM_DURATION = 0.25
const GAME_OVER_GRAVITY_ACCEL = -22
const GAME_OVER_GRAVITY_SCATTER_SPEED = 2.5
const GAME_OVER_GRAVITY_SPIN_FACTOR = 1.5
const SIMULATED_FPS = 60
const ROLL_ANIM_FRAMES = 0.3 * SIMULATED_FPS
const ROLL_WAITING_OFFSET_X = 1.5
const GROUND_THICKNESS = 0.15
const GROUND_MARGIN = BUBBLE_DIAMETER * 0.5
const GROUND_COLOR = 0x33334d
const ROW_DROP_COUNT = 2
const HIGH_SCORE_KEY = 'bubble-shooter-high-score'
const MARBLE_SIZE = 128
const MARBLE_PIXEL_COUNT = MARBLE_SIZE * MARBLE_SIZE
const MARBLE_VEIN_SCALE = 28
const MARBLE_BASE_BRIGHTNESS = 155
const MARBLE_VEIN_BRIGHTNESS = 100
const MARBLE_ALPHA = 255

const buildMarbleTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = MARBLE_SIZE
  canvas.height = MARBLE_SIZE
  const painter = canvas.getContext('2d')
  if (!painter) return new THREE.CanvasTexture(canvas)
  const pixelData = Array.from({ length: MARBLE_PIXEL_COUNT }, (_, index) => {
    const x = index % MARBLE_SIZE
    const y = Math.floor(index / MARBLE_SIZE)
    const noise =
      Math.sin(x / 20 + y / 40) * 0.5 +
      Math.sin(x / 8 + y / 12) * 0.3 +
      Math.sin(Math.hypot(x - MARBLE_SIZE / 2, y - MARBLE_SIZE / 2) / 12) * 0.2
    const vein = Math.abs(Math.sin((x + y) / MARBLE_VEIN_SCALE + noise * 4))
    const brightness = Math.max(
      0,
      Math.min(MARBLE_ALPHA, Math.floor(MARBLE_BASE_BRIGHTNESS + vein * MARBLE_VEIN_BRIGHTNESS))
    )
    return [brightness, brightness, brightness, MARBLE_ALPHA]
  }).flat()
  painter.putImageData(
    new ImageData(new Uint8ClampedArray(pixelData), MARBLE_SIZE, MARBLE_SIZE),
    0,
    0
  )
  return new THREE.CanvasTexture(canvas)
}

const marbleTexture = buildMarbleTexture()

const ROLL_PREVIEW = new THREE.Vector3(WALL_LEFT - PREVIEW_OFFSET_X, SHOOTER_Y, 0)
const ROLL_WAITING = new THREE.Vector3(SHOOTER_X - ROLL_WAITING_OFFSET_X, SHOOTER_Y, 0)
const ROLL_DOCK = new THREE.Vector3(SHOOTER_X, SHOOTER_Y + SHOOTER_HEIGHT + BUBBLE_RADIUS, 0)

type SessionHandles = {
  animFrameId: number
  cleanupTools: (() => void) | null
  unbindInput: (() => void) | null
  controls: ReturnType<typeof createControls> | null
  canvasResizeObserver: ResizeObserver | null
  gameOverTimeoutId: ReturnType<typeof setTimeout> | undefined
  gamepadInitTimeoutId: ReturnType<typeof setTimeout> | undefined
  lastTime: number
}

const loadHighScore = (): number => {
  const parsed = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? '0')
  return isNaN(parsed) ? 0 : parsed
}

const fitCamera = (camera: THREE.PerspectiveCamera, aspectRatio: number): void => {
  const fovByHeight = 2 * Math.atan((GAME_HEIGHT * CAMERA_FIT_MARGIN) / 2 / CAMERA_Z) * RAD_TO_DEG
  const fovByWidth =
    2 * Math.atan((GAME_WIDTH * CAMERA_FIT_MARGIN) / 2 / (CAMERA_Z * aspectRatio)) * RAD_TO_DEG
  camera.fov = Math.max(fovByHeight, fovByWidth)
  camera.updateProjectionMatrix()
}

const getMaterial = (ctx: BsGameContext, color: BubbleColor): THREE.MeshStandardMaterial => {
  if (!ctx.materials[color]) {
    ctx.materials[color] = new THREE.MeshStandardMaterial({
      color: COLOR_HEX[color],
      map: marbleTexture,
      roughness: 0.3,
      metalness: 0.1
    })
  }
  return ctx.materials[color]!
}

const placeBubbleMesh = (
  ctx: BsGameContext,
  row: number,
  col: number,
  color: BubbleColor
): void => {
  if (!ctx.scene) return
  const { x, y } = cellToWorld(row, col)
  const mesh = new THREE.Mesh(ctx.bubbleGeo, getMaterial(ctx, color))
  mesh.position.set(x, y, 0)
  ctx.scene.add(mesh)
  ctx.bubbleMeshes.set(`${row},${col}`, mesh)
}

const removeBubbleMesh = (ctx: BsGameContext, row: number, col: number): void => {
  const mesh = ctx.bubbleMeshes.get(`${row},${col}`)
  if (mesh && ctx.scene) {
    ctx.scene.remove(mesh)
    ctx.bubbleMeshes.delete(`${row},${col}`)
  }
}

const rebuildAllMeshes = (ctx: BsGameContext): void => {
  if (!ctx.scene) return
  ctx.bubbleMeshes.forEach((mesh) => ctx.scene!.remove(mesh))
  ctx.bubbleMeshes.clear()
  ctx.grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.color) placeBubbleMesh(ctx, r, c, cell.color)
    })
  })
}

const computeTrajectoryPoints = (ctx: BsGameContext): void => {
  const pts = trajectoryPoints(ctx.aimAngle, SHOOTER_X, SHOOTER_Y, ctx.grid, {
    wallLeft: WALL_LEFT,
    wallRight: WALL_RIGHT,
    ceilingY: GRID_TOP_Y + BUBBLE_RADIUS
  })
  ctx.trajectoryPoints = pts
  ctx.trajectoryCumulative = pts.reduce<number[]>((accumulator, point, index) => {
    if (index === 0) return [0]
    const previous = pts[index - 1]
    const distance = accumulator[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y)
    return [...accumulator, distance]
  }, [])
  ctx.trajectoryTotalLength = ctx.trajectoryCumulative.at(-1) ?? 0
}

const createTrajectoryDots = (scene: THREE.Scene): THREE.Mesh[] => {
  const geo = new THREE.SphereGeometry(TRAJECTORY_DOT_RADIUS, 8, 8)
  return Array.from({ length: TRAJECTORY_DOT_COUNT }, () => {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
    )
    mesh.visible = false
    scene.add(mesh)
    return mesh
  })
}

const setDotPositionAtFraction = (mesh: THREE.Mesh, ctx: BsGameContext, fraction: number): void => {
  const {
    trajectoryPoints: pts,
    trajectoryCumulative: cumulative,
    trajectoryTotalLength: total
  } = ctx
  if (pts.length < 2 || total <= 0) return
  const targetDistance = fraction * total
  const foundIndex = cumulative.findIndex((distance) => distance >= targetDistance)
  const endIndex = foundIndex === -1 ? pts.length - 1 : Math.max(1, foundIndex)
  const start = pts[endIndex - 1]
  const end = pts[endIndex]
  const segmentLength = cumulative[endIndex] - cumulative[endIndex - 1]
  const segmentT =
    segmentLength > 0 ? (targetDistance - cumulative[endIndex - 1]) / segmentLength : 0
  mesh.position.set(
    start.x + (end.x - start.x) * segmentT,
    start.y + (end.y - start.y) * segmentT,
    TRAJECTORY_Z
  )
}

const tickTrajectoryDots = (ctx: BsGameContext, delta: number): void => {
  const shouldShow = !ctx.isFlying && !ctx.isGameOver.value && ctx.trajectoryPoints.length >= 2
  if (!shouldShow) {
    ctx.trajectoryDots.forEach((dot) => {
      dot.visible = false
    })
    return
  }
  ctx.trajectoryPhase = (ctx.trajectoryPhase + delta * TRAJECTORY_DOT_SPEED) % 1
  ctx.trajectoryDots.forEach((dot, index) => {
    const fraction = (ctx.trajectoryPhase + index * TRAJECTORY_DOT_SPACING) % 1
    setDotPositionAtFraction(dot, ctx, fraction)
    dot.visible = true
    const remainingDistance = (1 - fraction) * ctx.trajectoryTotalLength
    const opacity = Math.min(remainingDistance / TRAJECTORY_DOT_FADE_DISTANCE, 1)
    ;(dot.material as THREE.MeshStandardMaterial).opacity = opacity
  })
}

const buildStaticScene = (
  ctx: BsGameContext,
  sc: THREE.Scene,
  cam: THREE.PerspectiveCamera
): void => {
  ctx.scene = sc
  ctx.camera = cam

  sc.background = new THREE.Color(0x1a1a2e)
  sc.add(new THREE.AmbientLight(0xffffff, 0.8))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
  dirLight.position.set(5, 10, 10)
  sc.add(dirLight)

  const surfaceMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4e })
  const ceilingWidth = WALL_RIGHT - WALL_LEFT + WALL_THICKNESS
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(ceilingWidth, WALL_THICKNESS, WALL_DEPTH),
    surfaceMat
  )
  ceiling.position.set(0, WALL_TOP_Y + WALL_THICKNESS / 2, 0)
  sc.add(ceiling)

  const wallHeight = WALL_TOP_Y - WALL_BOTTOM_Y
  const wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, wallHeight, WALL_DEPTH)
  const wallCenterY = (WALL_TOP_Y + WALL_BOTTOM_Y) / 2
  const wallL = new THREE.Mesh(wallGeo, surfaceMat)
  wallL.position.set(WALL_LEFT - WALL_THICKNESS / 2, wallCenterY, 0)
  sc.add(wallL)
  const wallR = new THREE.Mesh(wallGeo, surfaceMat)
  wallR.position.set(WALL_RIGHT + WALL_THICKNESS / 2, wallCenterY, 0)
  sc.add(wallR)

  const fireLineMat = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    emissive: 0xff4444,
    emissiveIntensity: 0.4
  })
  const fireLine = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_RIGHT - WALL_LEFT, FIRE_LINE_HEIGHT, WALL_DEPTH),
    fireLineMat
  )
  fireLine.position.set(0, FIRE_LINE_Y, 0)
  sc.add(fireLine)

  // Pick initial colors BEFORE creating the shooter meshes so they match the HUD
  ctx.grid = createGrid(undefined, ctx.deps.colorCount.value)
  ctx.currentColor.value = pickNextColor(ctx.grid)
  ctx.nextColor.value = pickNextColor(ctx.grid)

  ctx.shooterGroup = new THREE.Group()
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(
      SHOOTER_BASE_RADIUS * 0.5,
      SHOOTER_BASE_RADIUS * 0.5,
      SHOOTER_HEIGHT,
      8
    ),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  )
  barrel.position.set(0, SHOOTER_HEIGHT / 2, 0)
  ctx.shooterGroup.add(barrel)
  ctx.loadedMesh = new THREE.Mesh(ctx.bubbleGeo, getMaterial(ctx, ctx.currentColor.value))
  ctx.loadedMesh.position.set(0, SHOOTER_HEIGHT + BUBBLE_RADIUS, 0)
  ctx.loadedMesh.visible = true
  ctx.shooterGroup.add(ctx.loadedMesh)
  ctx.shooterGroup.position.set(SHOOTER_X, SHOOTER_Y, 0)
  sc.add(ctx.shooterGroup)

  ctx.nextMesh = new THREE.Mesh(ctx.bubbleGeo, getMaterial(ctx, ctx.nextColor.value))
  ctx.nextMesh.position.copy(ROLL_PREVIEW)
  ctx.nextMesh.scale.setScalar(PREVIEW_SCALE)
  sc.add(ctx.nextMesh)

  const groundWidth = WALL_RIGHT - WALL_LEFT + GROUND_MARGIN * 2
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(groundWidth, GROUND_THICKNESS, BUBBLE_DIAMETER),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR })
  )
  ground.position.set(
    (WALL_LEFT + WALL_RIGHT) / 2,
    SHOOTER_Y - BUBBLE_RADIUS * 0.92 - GROUND_THICKNESS / 2,
    0
  )
  sc.add(ground)

  ctx.trajectoryDots = createTrajectoryDots(sc)

  rebuildAllMeshes(ctx)
  computeTrajectoryPoints(ctx)
}

const playPopSound = (index: number): void => {
  const baseFreq = 520 + (index % 5) * 40
  createSound({
    startFreq: baseFreq,
    endFreq: baseFreq * 0.4,
    duration: 0.09,
    volume: 0.18,
    waveType: 'sine',
    attackTime: 0.004,
    releaseTime: 0.07,
    reverbAmount: 0.35
  })
}

const spawnPopParticles = (
  ctx: BsGameContext,
  x: number,
  y: number,
  color: BubbleColor,
  index = 0
): void => {
  playPopSound(index)
  if (!ctx.scene) return
  const mat = new THREE.MeshStandardMaterial({
    color: COLOR_HEX[color],
    transparent: true,
    opacity: 1
  })
  const geo = new THREE.SphereGeometry(BUBBLE_RADIUS * 0.35, 6, 6)
  Array.from({ length: POP_PARTICLE_COUNT }).forEach((_, i) => {
    const angle = (i / POP_PARTICLE_COUNT) * Math.PI * 2
    const mesh = new THREE.Mesh(geo, mat.clone())
    mesh.position.set(x, y, 0.2)
    ctx.scene!.add(mesh)
    ctx.popParticles.push({
      mesh,
      vx: Math.cos(angle) * POP_SPEED,
      vy: Math.sin(angle) * POP_SPEED,
      life: POP_LIFETIME
    })
  })
  geo.dispose()
}

const tickPopParticles = (ctx: BsGameContext, delta: number): void => {
  ctx.popParticles = ctx.popParticles.filter((p) => {
    p.life -= delta
    if (p.life <= 0) {
      ctx.scene?.remove(p.mesh)
      ;(p.mesh.material as THREE.MeshStandardMaterial).dispose()
      return false
    }
    const t = 1 - p.life / POP_LIFETIME
    p.mesh.position.x += p.vx * delta
    p.mesh.position.y += p.vy * delta
    p.mesh.scale.setScalar(1 - t * 0.7)
    ;(p.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - t
    return true
  })
}

const dockRollMesh = (ctx: BsGameContext): void => {
  if (ctx.rollMesh && ctx.scene) ctx.scene.remove(ctx.rollMesh)
  ctx.rollMesh = null
  ctx.rollPhase = 'idle'
  ctx.rollActionId = null
  if (ctx.loadedMesh) {
    ctx.loadedMesh.material = getMaterial(ctx, ctx.currentColor.value) as THREE.Material
    ctx.loadedMesh.visible = true
  }
}

const cancelRollAction = (ctx: BsGameContext): void => {
  if (!ctx.rollActionId) return
  ctx.rollTimeline.removeAction(ctx.rollActionId)
  ctx.rollActionId = null
}

type RollLeg = {
  startFrame: number
  from: THREE.Vector3
  to: THREE.Vector3
  fromScale: number
  onCompletePhase: (ctx: BsGameContext) => void
}

/**
 * Build a timeline action that lerps the rolling bubble between two
 * positions/scales over `ROLL_ANIM_FRAMES`, spinning it as it travels.
 * @param ctx - Game context.
 * @param leg - Start frame, from/to position+scale, and completion callback.
 * @returns A Timeline action ready to add to `ctx.rollTimeline`.
 */
const createRollAction = (ctx: BsGameContext, leg: RollLeg): Timeline => {
  const { startFrame, from, to, fromScale, onCompletePhase } = leg
  return {
    start: startFrame,
    duration: ROLL_ANIM_FRAMES,
    autoRemove: true,
    action: () => {
      if (!ctx.rollMesh) return
      const progress = Math.min((ctx.frame - startFrame) / ROLL_ANIM_FRAMES, 1)
      const eased = progress * progress * (3 - 2 * progress)
      const previousX = ctx.rollMesh.position.x
      ctx.rollMesh.position.lerpVectors(from, to, eased)
      ctx.rollMesh.scale.setScalar(fromScale + (1 - fromScale) * eased)
      const rotationDelta = (ctx.rollMesh.position.x - previousX) / BUBBLE_RADIUS
      ctx.rollMesh.rotation.z -= rotationDelta
    },
    onComplete: () => {
      if (!ctx.rollMesh) return
      ctx.rollMesh.position.copy(to)
      ctx.rollMesh.scale.setScalar(1)
      onCompletePhase(ctx)
    }
  }
}

/**
 * Start the "next" bubble rolling from the preview slot to the waiting spot
 * beside the cannon, called as soon as the player shoots.
 * @param ctx - Game context.
 * @param rollColor - Color of the bubble that will become the new loaded color.
 * @returns Nothing.
 */
const startWaitingRoll = (ctx: BsGameContext, rollColor: BubbleColor): void => {
  if (!ctx.scene) return
  cancelRollAction(ctx)
  if (ctx.rollPhase === 'docking') dockRollMesh(ctx)
  const mesh = new THREE.Mesh(ctx.bubbleGeo, getMaterial(ctx, rollColor))
  mesh.position.copy(ROLL_PREVIEW)
  mesh.scale.setScalar(PREVIEW_SCALE)
  ctx.scene.add(mesh)
  ctx.rollMesh = mesh
  ctx.rollPhase = 'waiting'
  ctx.rollActionId = ctx.rollTimeline.addAction(
    createRollAction(ctx, {
      startFrame: ctx.frame,
      from: ROLL_PREVIEW,
      to: ROLL_WAITING,
      fromScale: PREVIEW_SCALE,
      onCompletePhase: () => {
        ctx.rollActionId = null
      }
    })
  )
  if (ctx.nextMesh) ctx.nextMesh.visible = false
  if (ctx.loadedMesh) ctx.loadedMesh.visible = false
}

/**
 * Start the waiting bubble rolling from beside the cannon into the loaded
 * position, called once the in-flight shot resolves.
 * @param ctx - Game context.
 * @returns Nothing.
 */
const startDockingRoll = (ctx: BsGameContext): void => {
  if (!ctx.rollMesh) {
    dockRollMesh(ctx)
    return
  }
  cancelRollAction(ctx)
  if (ctx.rollPhase === 'waiting') {
    ctx.rollMesh.position.copy(ROLL_WAITING)
    ctx.rollMesh.scale.setScalar(1)
  }
  ctx.rollPhase = 'docking'
  ctx.rollActionId = ctx.rollTimeline.addAction(
    createRollAction(ctx, {
      startFrame: ctx.frame,
      from: ROLL_WAITING,
      to: ROLL_DOCK,
      fromScale: 1,
      onCompletePhase: dockRollMesh
    })
  )
}

/**
 * Drop all bubble meshes off-screen with simple gravity once the game has ended.
 * @param ctx - Game context.
 * @param delta - Frame time in seconds.
 * @returns Nothing.
 */
const tickGravity = (ctx: BsGameContext, delta: number): void => {
  ctx.bubbleMeshes.forEach((mesh, key) => {
    const velocity = ctx.gravityVelocities.get(key)
    if (!velocity) return
    velocity.vy += GAME_OVER_GRAVITY_ACCEL * delta
    mesh.position.x += velocity.vx * delta
    mesh.position.y += velocity.vy * delta
    mesh.rotation.z += velocity.vx * GAME_OVER_GRAVITY_SPIN_FACTOR * delta
  })
}

const tickMeshAnimations = (ctx: BsGameContext, delta: number): void => {
  ctx.frame += delta * SIMULATED_FPS
  animateTimeline(ctx.rollTimeline, ctx.frame, undefined, { enableAutoRemoval: true })

  if (ctx.isGameOver.value) {
    tickGravity(ctx, delta)
    return
  }

  const rowDropMs = SPEED_ROW_DROP_MS[ctx.deps.speed.value]
  const timeToNextDrop = rowDropMs - ctx.rowDropAccumulator
  const inShakeWindow =
    !ctx.dropAnimActive && timeToNextDrop <= SHAKE_THRESHOLD_MS && !ctx.isGameOver.value
  const shakeIntensity = inShakeWindow ? 1 - timeToNextDrop / SHAKE_THRESHOLD_MS : 0
  const shakeX = inShakeWindow
    ? Math.sin((performance.now() / 1000) * SHAKE_FREQUENCY * Math.PI * 2) *
      SHAKE_AMPLITUDE *
      shakeIntensity
    : 0

  if (ctx.dropAnimActive) ctx.dropAnimElapsed += delta
  const dropProgress = ctx.dropAnimActive
    ? Math.min(ctx.dropAnimElapsed / DROP_ANIM_DURATION, 1)
    : 1
  const smoothed = dropProgress * dropProgress * (3 - 2 * dropProgress)
  const dropOffsetY = ctx.dropAnimActive ? ctx.dropAnimOffset * (1 - smoothed) : 0

  ctx.bubbleMeshes.forEach((mesh, key) => {
    const separatorIndex = key.indexOf(',')
    const row = Number(key.slice(0, separatorIndex))
    const col = Number(key.slice(separatorIndex + 1))
    const { x: baseX, y: baseY } = cellToWorld(row, col)
    mesh.position.x = baseX + shakeX
    mesh.position.y = baseY + dropOffsetY
  })

  if (ctx.dropAnimActive && dropProgress >= 1) {
    ctx.dropAnimActive = false
    ctx.dropAnimElapsed = 0
    ctx.dropAnimOffset = 0
  }
}

const resetContextAndHandles = (ctx: BsGameContext, handles: SessionHandles): void => {
  cancelAnimationFrame(handles.animFrameId)
  handles.cleanupTools?.()
  handles.canvasResizeObserver?.disconnect()
  handles.unbindInput?.()
  handles.controls?.destroyControls()
  clearTimeout(handles.gameOverTimeoutId)
  clearTimeout(handles.gamepadInitTimeoutId)
  handles.cleanupTools = null
  handles.unbindInput = null
  handles.controls = null
  handles.canvasResizeObserver = null
  handles.gameOverTimeoutId = undefined
  handles.gamepadInitTimeoutId = undefined
  handles.lastTime = 0
  ctx.score.value = 0
  ctx.shotCount.value = 0
  ctx.isGameOver.value = false
  ctx.pendingGarbage.value = 0
  ctx.rowDropAccumulator = 0
  ctx.dropAnimActive = false
  ctx.dropAnimElapsed = 0
  ctx.dropAnimOffset = 0
  ctx.isFlying = false
  ctx.aimAngle = 0
  ctx.inFlightDx = 0
  ctx.inFlightDy = 0
  ctx.gamepadFirePressed = false
  ctx.gamepadAimHoldMs = 0
  ctx.gamepadInputInitialized = false
  ctx.popParticles = []
  ctx.bubbleMeshes.clear()
  ctx.gravityVelocities.clear()
  ctx.inFlightMesh = null
  if (ctx.rollMesh && ctx.scene) ctx.scene.remove(ctx.rollMesh)
  ctx.rollMesh = null
  ctx.rollPhase = 'idle'
  ctx.rollActionId = null
  ctx.rollTimeline.clearAll()
  ctx.frame = 0
  ctx.scene = null
  ctx.camera = null
  ctx.shooterGroup = null
  ctx.trajectoryDots = []
  ctx.trajectoryPoints = []
  ctx.trajectoryCumulative = []
  ctx.trajectoryTotalLength = 0
  ctx.trajectoryPhase = 0
  ctx.loadedMesh = null
  ctx.nextMesh = null
}

/**
 * Project a world-space point onto the canvas as percentage coordinates.
 * @param camera - Active scene camera.
 * @param x - World x position.
 * @param y - World y position.
 * @returns Position as percentages of canvas width/height (0-100).
 */
const worldToScreenPercent = (
  camera: THREE.PerspectiveCamera,
  x: number,
  y: number
): { xPercent: number; yPercent: number } => {
  const projected = new THREE.Vector3(x, y, 0).project(camera)
  return { xPercent: ((projected.x + 1) / 2) * 100, yPercent: ((1 - projected.y) / 2) * 100 }
}

const handleCollision = (
  ctx: BsGameContext,
  hitX: number,
  hitY: number,
  color: BubbleColor
): void => {
  const snapped = snapToCell(hitX, hitY, ctx.grid)
  if (!snapped) {
    ctx.isFlying = false
    return
  }

  ctx.grid[snapped.row][snapped.col] = { color }
  placeBubbleMesh(ctx, snapped.row, snapped.col, color)

  const matched = findMatch(snapped.row, snapped.col, ctx.grid)
  if (matched.length > 0) {
    const matchPoints = matched.length * MATCH_POINTS_PER_BUBBLE
    matched.forEach(([r, c], i) => {
      const { x: px, y: py } = cellToWorld(r, c)
      spawnPopParticles(ctx, px, py, ctx.grid[r][c].color ?? color, i)
      ctx.grid[r][c] = { color: null }
      removeBubbleMesh(ctx, r, c)
    })
    const dangling = findDangling(ctx.grid)
    const comboPoints = dangling.length * COMBO_POINTS_PER_BUBBLE
    dangling.forEach(([r, c], i) => {
      const { x: px, y: py } = cellToWorld(r, c)
      spawnPopParticles(ctx, px, py, ctx.grid[r][c].color ?? 'garbage', matched.length + i)
      ctx.grid[r][c] = { color: null }
      removeBubbleMesh(ctx, r, c)
    })

    ctx.score.value += matchPoints + comboPoints
    if (ctx.camera) {
      const { x, y } = averageCellPosition([...matched, ...dangling])
      const { xPercent, yPercent } = worldToScreenPercent(ctx.camera, x, y)
      ctx.deps.onScore({ points: matchPoints + comboPoints, comboPoints, xPercent, yPercent })
    }

    const rowsCleared = Math.floor((matched.length + dangling.length) / GRID_COLS)
    if (rowsCleared >= GARBAGE_THRESHOLD) ctx.deps.onGarbageSent(rowsCleared)
  }

  if (ctx.pendingGarbage.value > 0) {
    const count = ctx.pendingGarbage.value
    ctx.pendingGarbage.value = 0
    ctx.grid = addGarbageRows(ctx.grid, count)
    rebuildAllMeshes(ctx)
  }

  ctx.shotCount.value++

  if (hasReachedFireLine(ctx.grid, FIRE_LINE_Y)) {
    ctx.onGameOverInternal()
    return
  }

  ctx.currentColor.value = ctx.nextColor.value
  ctx.nextColor.value = pickNextColor(ctx.grid)
  if (ctx.nextMesh) {
    ctx.nextMesh.material = getMaterial(ctx, ctx.nextColor.value) as THREE.Material
    ctx.nextMesh.position.copy(ROLL_PREVIEW)
    ctx.nextMesh.scale.setScalar(PREVIEW_SCALE)
    ctx.nextMesh.visible = true
  }
  startDockingRoll(ctx)
  computeTrajectoryPoints(ctx)
  ctx.isFlying = false
}

const runGameLoop = (ctx: BsGameContext, delta: number): void => {
  tickPopParticles(ctx, delta)
  tickTrajectoryDots(ctx, delta)

  if (!ctx.isGameOver.value) {
    ctx.rowDropAccumulator += delta * 1000
    const rowDropMs = SPEED_ROW_DROP_MS[ctx.deps.speed.value]
    if (ctx.rowDropAccumulator >= rowDropMs) {
      ctx.rowDropAccumulator -= rowDropMs
      ctx.grid = addTopRows(ctx.grid, ROW_DROP_COUNT)
      ctx.dropAnimActive = true
      ctx.dropAnimElapsed = 0
      ctx.dropAnimOffset = ROW_DROP_COUNT * HEX_ROW_HEIGHT
      rebuildAllMeshes(ctx)
      if (hasReachedFireLine(ctx.grid, FIRE_LINE_Y)) {
        ctx.onGameOverInternal()
        return
      }
    }
  }

  if (ctx.isGameOver.value || !ctx.isFlying || !ctx.inFlightMesh) {
    tickMeshAnimations(ctx, delta)
    return
  }
  const distance = BUBBLE_SPEED * delta
  let nx = ctx.inFlightMesh.position.x + ctx.inFlightDx * distance
  const ny = ctx.inFlightMesh.position.y + ctx.inFlightDy * distance

  if (nx <= WALL_LEFT) {
    nx = WALL_LEFT
    ctx.inFlightDx = Math.abs(ctx.inFlightDx)
  } else if (nx >= WALL_RIGHT) {
    nx = WALL_RIGHT
    ctx.inFlightDx = -Math.abs(ctx.inFlightDx)
  }

  ctx.inFlightMesh.position.set(nx, ny, 0)

  if (ny >= GRID_TOP_Y) {
    const color = ctx.inFlightMesh.userData.color as BubbleColor
    ctx.scene?.remove(ctx.inFlightMesh)
    ctx.inFlightMesh = null
    handleCollision(ctx, nx, GRID_TOP_Y, color)
    tickMeshAnimations(ctx, delta)
    return
  }

  const hit = ctx.grid
    .flatMap((row, r) => row.map((cell, c) => ({ cell, r, c })))
    .find(({ cell, r, c }) => {
      if (!cell.color) return false
      const { x: bx, y: by } = cellToWorld(r, c)
      return Math.hypot(nx - bx, ny - by) < BUBBLE_DIAMETER * 0.95
    })
  if (hit && ctx.inFlightMesh) {
    const color = ctx.inFlightMesh.userData.color as BubbleColor
    ctx.scene?.remove(ctx.inFlightMesh)
    ctx.inFlightMesh = null
    handleCollision(ctx, nx, ny, color)
  }
  tickMeshAnimations(ctx, delta)
}

const computeAimAngle = (
  clientX: number,
  clientY: number,
  canvasElement: HTMLCanvasElement,
  cam: THREE.PerspectiveCamera
): number | null => {
  const rect = canvasElement.getBoundingClientRect()
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const target = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, target)
  const dy = target.y - SHOOTER_Y
  if (dy <= 0) return null
  const raw = Math.atan2(target.x - SHOOTER_X, dy)
  return Math.max(AIM_MIN_ANGLE, Math.min(AIM_MAX_ANGLE, raw))
}

const applyAim = (ctx: BsGameContext, angle: number): void => {
  ctx.aimAngle = angle
  if (ctx.shooterGroup) ctx.shooterGroup.rotation.z = -angle
  if (!ctx.isFlying) computeTrajectoryPoints(ctx)
}

const shoot = (ctx: BsGameContext): void => {
  if (ctx.isFlying || ctx.isGameOver.value || !ctx.scene) return
  const color = ctx.currentColor.value
  const mesh = new THREE.Mesh(ctx.bubbleGeo, getMaterial(ctx, color))
  mesh.position.set(SHOOTER_X, SHOOTER_Y + SHOOTER_HEIGHT, 0)
  mesh.userData.color = color
  ctx.scene.add(mesh)
  ctx.inFlightMesh = mesh
  ctx.inFlightDx = Math.sin(ctx.aimAngle)
  ctx.inFlightDy = Math.cos(ctx.aimAngle)
  ctx.isFlying = true
  startWaitingRoll(ctx, ctx.nextColor.value)
  computeTrajectoryPoints(ctx)
}

const onPlayAgainPressedHolder = { current: null as (() => void) | null }

/**
 * Register a callback to fire when the gamepad's fire button is pressed while the
 * game-over summary screen is shown. Pass `null` to clear it on cleanup.
 * @param callback - Handler to invoke on fire-button press, or `null` to unregister.
 * @returns Nothing.
 */
export const setOnPlayAgainPressed = (callback: (() => void) | null): void => {
  onPlayAgainPressedHolder.current = callback
}

const stepGamepadInput = (
  ctx: BsGameContext,
  currentActions: ControlsCurrents,
  delta: number
): void => {
  const firePressed = 'fire' in currentActions

  if (!ctx.gamepadInputInitialized) {
    ctx.gamepadInputInitialized = true
    ctx.gamepadFirePressed = firePressed
    ctx.gamepadAimHoldMs = 0
    return
  }

  const fireJustPressed = firePressed && !ctx.gamepadFirePressed
  ctx.gamepadFirePressed = firePressed

  if (ctx.isGameOver.value) {
    ctx.gamepadAimHoldMs = 0
    if (fireJustPressed) onPlayAgainPressedHolder.current?.()
    return
  }

  const aimingLeft = 'aim-left' in currentActions
  const aimingRight = 'aim-right' in currentActions
  const direction = aimingRight ? 1 : aimingLeft ? -1 : 0
  const { angle, holdMs } = stepGamepadAimAngle(
    ctx.aimAngle,
    direction,
    ctx.gamepadAimHoldMs,
    delta,
    {
      minAngle: AIM_MIN_ANGLE,
      maxAngle: AIM_MAX_ANGLE
    }
  )
  ctx.gamepadAimHoldMs = holdMs
  if (direction !== 0) applyAim(ctx, angle)

  if (fireJustPressed) shoot(ctx)
}

const bindInputEvents = (ctx: BsGameContext): (() => void) => {
  const element = ctx.deps.canvas.value!

  const onPointerMove = (e: PointerEvent): void => {
    if (!ctx.deps.canvas.value || !ctx.camera || ctx.isGameOver.value) return
    const angle = computeAimAngle(e.clientX, e.clientY, ctx.deps.canvas.value, ctx.camera)
    if (angle !== null) applyAim(ctx, angle)
  }
  const onPointerDown = (e: PointerEvent): void => {
    if (ctx.isGameOver.value) return
    onPointerMove(e)
    if (e.pointerType !== 'touch') shoot(ctx)
  }
  const onTouchMove = (e: TouchEvent): void => {
    const touch = e.touches[0]
    if (!touch || !ctx.deps.canvas.value || !ctx.camera || ctx.isGameOver.value) return
    const angle = computeAimAngle(touch.clientX, touch.clientY, ctx.deps.canvas.value, ctx.camera)
    if (angle !== null) applyAim(ctx, angle)
  }
  const onTouchEnd = (): void => {
    if (!ctx.isGameOver.value) shoot(ctx)
  }
  const onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('touchmove', onTouchMove, { passive: true })
  element.addEventListener('touchend', onTouchEnd)
  element.addEventListener('contextmenu', onContextMenu)
  return () => {
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('touchmove', onTouchMove)
    element.removeEventListener('touchend', onTouchEnd)
    element.removeEventListener('contextmenu', onContextMenu)
  }
}

type GameRenderer = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  resizeObserver: ResizeObserver
}

const createGameRenderer = (
  ctx: BsGameContext,
  element: HTMLCanvasElement,
  width: number,
  height: number
): GameRenderer => {
  const renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true })
  renderer.setSize(width, height, false)
  renderer.setPixelRatio(window.devicePixelRatio)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 1000)
  camera.position.set(0, CAMERA_Y, CAMERA_Z)
  camera.lookAt(0, CAMERA_Y, 0)
  fitCamera(camera, width / height)
  buildStaticScene(ctx, scene, camera)
  const resizeObserver = new ResizeObserver(() => {
    const nw = element.clientWidth
    const nh = element.clientHeight
    if (nw > 0 && nh > 0) {
      camera.aspect = nw / nh
      fitCamera(camera, nw / nh)
      renderer.setSize(nw, nh, false)
    }
  })
  resizeObserver.observe(element)
  return { renderer, scene, camera, resizeObserver }
}

/**
 * Build and manage the Three.js bubble shooter scene.
 * @param deps - Canvas ref, mode flags, and game-event callbacks.
 * @returns Reactive game state refs and imperative controls.
 */
export const useBubbleShooterGame = (deps: GameDeps) => {
  const score = ref(0)
  const shotCount = ref(0)
  const currentColor = ref<BubbleColor>('red')
  const nextColor = ref<BubbleColor>('blue')
  const isGameOver = ref(false)
  const pendingGarbage = ref(0)
  const highScore = ref(loadHighScore())

  const ctx: BsGameContext = {
    grid: [],
    aimAngle: 0,
    isFlying: false,
    inFlightDx: 0,
    inFlightDy: 0,
    rowDropAccumulator: 0,
    dropAnimActive: false,
    dropAnimElapsed: 0,
    dropAnimOffset: 0,
    scene: null,
    camera: null,
    shooterGroup: null,
    trajectoryDots: [],
    trajectoryPoints: [],
    trajectoryCumulative: [],
    trajectoryTotalLength: 0,
    trajectoryPhase: 0,
    loadedMesh: null,
    nextMesh: null,
    inFlightMesh: null,
    rollMesh: null,
    rollPhase: 'idle',
    rollActionId: null,
    rollTimeline: createTimelineManager(),
    frame: 0,
    bubbleGeo: new THREE.SphereGeometry(BUBBLE_RADIUS * 0.92, 16, 16),
    bubbleMeshes: new Map(),
    gravityVelocities: new Map(),
    materials: {},
    popParticles: [],
    score,
    shotCount,
    currentColor,
    nextColor,
    isGameOver,
    pendingGarbage,
    gamepadFirePressed: false,
    gamepadAimHoldMs: 0,
    gamepadInputInitialized: false,
    onGameOverInternal: () => {},
    deps
  }

  const handles: SessionHandles = {
    animFrameId: 0,
    cleanupTools: null,
    unbindInput: null,
    controls: null,
    canvasResizeObserver: null,
    gameOverTimeoutId: undefined,
    gamepadInitTimeoutId: undefined,
    lastTime: 0
  }

  ctx.onGameOverInternal = (): void => {
    ctx.isGameOver.value = true
    ctx.isFlying = false
    if (score.value > highScore.value) {
      highScore.value = score.value
      localStorage.setItem(HIGH_SCORE_KEY, score.value.toString())
    }
    ctx.bubbleMeshes.forEach((_, key) => {
      ctx.gravityVelocities.set(key, {
        vx: (Math.random() - 0.5) * GAME_OVER_GRAVITY_SCATTER_SPEED,
        vy: 0
      })
    })
    handles.gameOverTimeoutId = setTimeout(() => {
      ctx.deps.onGameOver()
    }, GAME_OVER_DELAY_MS)
  }

  const receiveGarbage = (count: number): void => {
    const rows = count % 2 === 0 ? count : count + 1
    if (ctx.isFlying) {
      pendingGarbage.value += rows
      return
    }
    ctx.grid = addGarbageRows(ctx.grid, rows)
    rebuildAllMeshes(ctx)
    if (hasReachedFireLine(ctx.grid, FIRE_LINE_Y)) {
      ctx.onGameOverInternal()
    }
  }

  const init = (): void => {
    resetContextAndHandles(ctx, handles)
    const element = deps.canvas.value
    if (!element) return
    const w = element.clientWidth || element.offsetWidth || 400
    const h = element.clientHeight || element.offsetHeight || 600
    const { renderer, scene, camera, resizeObserver } = createGameRenderer(ctx, element, w, h)
    handles.canvasResizeObserver = resizeObserver
    handles.unbindInput = bindInputEvents(ctx)
    handles.gamepadInitTimeoutId = setTimeout(() => {
      handles.controls = createControls({
        mapping: loadMapping(CONTROLS_GAME_ID) ?? GAMEPAD_MAPPING,
        keyboard: false,
        touch: false,
        mouse: false
      })
    }, WATER_RISE_DURATION_MS)
    const tick = (): void => {
      handles.animFrameId = requestAnimationFrame(tick)
      const now = performance.now()
      const delta = handles.lastTime === 0 ? 0 : Math.min((now - handles.lastTime) / 1000, 0.05)
      handles.lastTime = now
      if (handles.controls) stepGamepadInput(ctx, handles.controls.currentActions, delta)
      runGameLoop(ctx, delta)
      renderer.render(scene, camera)
    }
    tick()
    handles.cleanupTools = (): void => {
      cancelAnimationFrame(handles.animFrameId)
      renderer.dispose()
    }
  }

  const cleanup = (): void => {
    resetContextAndHandles(ctx, handles)
    Object.values(ctx.materials).forEach((mat) => mat?.dispose())
    ctx.bubbleGeo.dispose()
  }

  onUnmounted(cleanup)

  return {
    score,
    shotCount,
    currentColor,
    nextColor,
    isGameOver,
    highScore,
    init,
    cleanup,
    receiveGarbage
  }
}
