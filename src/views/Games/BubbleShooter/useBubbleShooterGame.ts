import { ref, onUnmounted } from 'vue'
import * as THREE from 'three'
import { createSound } from '@webgamekit/audio'
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
  COLOR_HEX,
  type BubbleColor
} from './config'
import {
  createGrid,
  cellToWorld,
  findMatch,
  findDangling,
  snapToCell,
  trajectoryPoints,
  pickNextColor,
  hasReachedFireLine,
  addGarbageRows,
  addTopRows
} from './bubbleShooterUtilities'
import type { GameDeps, BsGameContext } from './types'

export type { GameDeps }

const CAMERA_Y = -1
const CAMERA_Z = 22
const CAMERA_FOV = 65
const AIM_MIN_ANGLE = -(Math.PI * 0.45)
const AIM_MAX_ANGLE = Math.PI * 0.45
const TRAJECTORY_Z = 0.1
const SHOOTER_HEIGHT = 0.6
const SHOOTER_BASE_RADIUS = 0.3
const WALL_THICKNESS = 0.3
const WALL_DEPTH = 0.5
const FIRE_LINE_HEIGHT = 0.08
const PREVIEW_SCALE = 0.7
const PREVIEW_OFFSET_X = 1.5
const MAX_TRAJ_PTS = 500
const POP_PARTICLE_COUNT = 6
const POP_LIFETIME = 0.35
const POP_SPEED = 3.5

const getMaterial = (ctx: BsGameContext, color: BubbleColor): THREE.MeshStandardMaterial => {
  if (!ctx.materials[color]) {
    ctx.materials[color] = new THREE.MeshStandardMaterial({
      color: COLOR_HEX[color],
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

const updateTrajectoryLine = (ctx: BsGameContext): void => {
  if (!ctx.trajectoryLine || !ctx.scene) return
  const pts = trajectoryPoints(ctx.aimAngle, SHOOTER_X, SHOOTER_Y, ctx.grid, {
    wallLeft: WALL_LEFT,
    wallRight: WALL_RIGHT,
    ceilingY: GRID_TOP_Y + BUBBLE_RADIUS
  })
  const positions = new Float32Array(pts.flatMap(({ x, y }) => [x, y, TRAJECTORY_Z]))
  const geo = ctx.trajectoryLine.geometry as THREE.BufferGeometry
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setDrawRange(0, pts.length)
  geo.computeBoundingSphere()
  ctx.trajectoryLine.computeLineDistances()
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
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(GRID_COLS + 1, WALL_THICKNESS, WALL_DEPTH),
    surfaceMat
  )
  ceiling.position.set(0, GRID_TOP_Y + BUBBLE_RADIUS + WALL_THICKNESS / 2, 0)
  sc.add(ceiling)

  const wallHeight = Math.abs(GRID_TOP_Y - SHOOTER_Y) + 3
  const wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, wallHeight, WALL_DEPTH)
  const wallCenterY = (GRID_TOP_Y + SHOOTER_Y) / 2
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
    new THREE.BoxGeometry(GRID_COLS + 1, FIRE_LINE_HEIGHT, WALL_DEPTH),
    fireLineMat
  )
  fireLine.position.set(0, FIRE_LINE_Y, 0)
  sc.add(fireLine)

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
  ctx.nextMesh.position.set(WALL_LEFT - PREVIEW_OFFSET_X, SHOOTER_Y, 0)
  ctx.nextMesh.scale.setScalar(PREVIEW_SCALE)
  sc.add(ctx.nextMesh)

  const trailGeo = new THREE.BufferGeometry()
  trailGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(MAX_TRAJ_PTS * 3), 3)
  )
  ctx.trajectoryLine = new THREE.Line(
    trailGeo,
    new THREE.LineDashedMaterial({
      color: 0xffffff,
      opacity: 0.5,
      transparent: true,
      dashSize: 0.4,
      gapSize: 0.2
    })
  )
  sc.add(ctx.trajectoryLine)

  ctx.grid = createGrid(undefined, ctx.deps.colorCount.value)
  ctx.currentColor.value = pickNextColor(ctx.grid)
  ctx.nextColor.value = pickNextColor(ctx.grid)
  rebuildAllMeshes(ctx)
  updateTrajectoryLine(ctx)
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
    releaseTime: 0.07
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
    const pts = matched.length * 10
    ctx.score.value += pts
    ctx.deps.onScore(pts)
    matched.forEach(([r, c], i) => {
      const { x: px, y: py } = cellToWorld(r, c)
      spawnPopParticles(ctx, px, py, ctx.grid[r][c].color ?? color, i)
      ctx.grid[r][c] = { color: null }
      removeBubbleMesh(ctx, r, c)
    })
    const dangling = findDangling(ctx.grid)
    const dpts = dangling.length * 5
    ctx.score.value += dpts
    ctx.deps.onScore(dpts)
    dangling.forEach(([r, c], i) => {
      const { x: px, y: py } = cellToWorld(r, c)
      spawnPopParticles(ctx, px, py, ctx.grid[r][c].color ?? 'garbage', matched.length + i)
      ctx.grid[r][c] = { color: null }
      removeBubbleMesh(ctx, r, c)
    })
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
    ctx.isGameOver.value = true
    ctx.isFlying = false
    ctx.deps.onGameOver()
    return
  }

  ctx.currentColor.value = ctx.nextColor.value
  ctx.nextColor.value = pickNextColor(ctx.grid)
  if (ctx.loadedMesh) {
    ctx.loadedMesh.material = getMaterial(ctx, ctx.currentColor.value) as THREE.Material
    ctx.loadedMesh.visible = true
  }
  if (ctx.nextMesh) ctx.nextMesh.material = getMaterial(ctx, ctx.nextColor.value) as THREE.Material
  updateTrajectoryLine(ctx)
  ctx.isFlying = false
}

const runGameLoop = (ctx: BsGameContext, delta: number): void => {
  tickPopParticles(ctx, delta)

  if (!ctx.isGameOver.value) {
    ctx.rowDropAccumulator += delta * 1000
    const rowDropMs = SPEED_ROW_DROP_MS[ctx.deps.speed.value]
    if (ctx.rowDropAccumulator >= rowDropMs) {
      ctx.rowDropAccumulator -= rowDropMs
      ctx.grid = addTopRows(ctx.grid, 2)
      rebuildAllMeshes(ctx)
      if (hasReachedFireLine(ctx.grid, FIRE_LINE_Y)) {
        ctx.isGameOver.value = true
        ctx.deps.onGameOver()
        return
      }
    }
  }

  if (ctx.isGameOver.value || !ctx.isFlying || !ctx.inFlightMesh) return
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
  if (!ctx.isFlying) updateTrajectoryLine(ctx)
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
  if (ctx.loadedMesh) ctx.loadedMesh.visible = false
  updateTrajectoryLine(ctx)
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

  const ctx: BsGameContext = {
    grid: [],
    aimAngle: 0,
    isFlying: false,
    inFlightDx: 0,
    inFlightDy: 0,
    rowDropAccumulator: 0,
    scene: null,
    camera: null,
    shooterGroup: null,
    trajectoryLine: null,
    loadedMesh: null,
    nextMesh: null,
    inFlightMesh: null,
    bubbleGeo: new THREE.SphereGeometry(BUBBLE_RADIUS * 0.92, 16, 16),
    bubbleMeshes: new Map(),
    materials: {},
    popParticles: [],
    score,
    shotCount,
    currentColor,
    nextColor,
    isGameOver,
    pendingGarbage,
    deps
  }

  let cleanupTools: (() => void) | null = null
  let unbindInput: (() => void) | null = null
  let canvasResizeObserver: ResizeObserver | null = null
  let lastTime = 0

  const receiveGarbage = (count: number): void => {
    const rows = count % 2 === 0 ? count : count + 1
    if (ctx.isFlying) {
      pendingGarbage.value += rows
      return
    }
    ctx.grid = addGarbageRows(ctx.grid, rows)
    rebuildAllMeshes(ctx)
    if (hasReachedFireLine(ctx.grid, FIRE_LINE_Y)) {
      isGameOver.value = true
      deps.onGameOver()
    }
  }

  let animFrameId = 0

  const init = (): void => {
    const element = deps.canvas.value
    if (!element) return

    const w = element.clientWidth || element.offsetWidth || 400
    const h = element.clientHeight || element.offsetHeight || 600

    const renderer = new THREE.WebGLRenderer({ canvas: element, antialias: true })
    renderer.setSize(w, h, false)
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 0.1, 1000)
    camera.position.set(0, CAMERA_Y, CAMERA_Z)
    camera.lookAt(0, CAMERA_Y, 0)

    buildStaticScene(ctx, scene, camera)

    canvasResizeObserver = new ResizeObserver(() => {
      const nw = element.clientWidth
      const nh = element.clientHeight
      if (nw > 0 && nh > 0) {
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
        renderer.setSize(nw, nh, false)
      }
    })
    canvasResizeObserver.observe(element)
    unbindInput = bindInputEvents(ctx)

    const tick = (): void => {
      animFrameId = requestAnimationFrame(tick)
      const now = performance.now()
      const delta = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      runGameLoop(ctx, delta)
      renderer.render(scene, camera)
    }
    tick()

    cleanupTools = (): void => {
      cancelAnimationFrame(animFrameId)
      renderer.dispose()
    }
  }

  const cleanup = (): void => {
    unbindInput?.()
    canvasResizeObserver?.disconnect()
    cleanupTools?.()
    Object.values(ctx.materials).forEach((mat) => mat?.dispose())
    ctx.bubbleGeo.dispose()
    ctx.bubbleMeshes.clear()
    ctx.popParticles.forEach((p) => {
      ctx.scene?.remove(p.mesh)
      ;(p.mesh.material as THREE.MeshStandardMaterial).dispose()
    })
    ctx.popParticles = []
    ctx.inFlightMesh = null
    ctx.scene = null
    ctx.camera = null
  }

  onUnmounted(cleanup)

  return { score, shotCount, currentColor, nextColor, isGameOver, init, cleanup, receiveGarbage }
}
