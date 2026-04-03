import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getModel, moveController, type ComplexModel, type Vec3 } from '@webgamekit/threejs'
import {
  logicCreateGrid,
  logicGridToWorld,
  logicMarkObstacle,
  logicGetBestRoute,
  logicIsCellWalkable,
  type Grid,
  type GridConfig,
  type Position2D
} from '@webgamekit/logic'
import {
  PAPER_PLANE_MODEL,
  paperPlaneModelOptions,
  ISLAND_SIZE,
  MAZE_CELL_SIZE,
  PAPER_PLANE_REPLAN_INTERVAL,
  PAPER_PLANE_WAYPOINT_REACH_DISTANCE,
  PAPER_PLANE_TURN_SPEED
} from '../config'
import type { MazeGrid } from './maze'

// 2x-resolution grid: maze cells at even positions, walls at odd positions.
// With N=10 cells and cellSize=8: grid is 19×19, nav-cellSize=4, centerOffset=[2,0,2].
const NAV_GRID_CELLS = Math.floor(ISLAND_SIZE / MAZE_CELL_SIZE)
const NAV_GRID_SIZE = NAV_GRID_CELLS * 2 - 1
const NAV_CELL_SIZE = MAZE_CELL_SIZE / 2
const NAV_CENTER_OFFSET = NAV_CELL_SIZE / 2

export const NAVIGATION_GRID_CONFIG: GridConfig = {
  width: NAV_GRID_SIZE,
  height: NAV_GRID_SIZE,
  cellSize: NAV_CELL_SIZE,
  centerOffset: [NAV_CENTER_OFFSET, 0, NAV_CENTER_OFFSET]
}

export interface PaperPlanePathState {
  path: Position2D[] | null
  currentIndex: number
  timeSinceReplan: number
  stuckTime: number
}

export const createInitialPaperPlanePathState = (): PaperPlanePathState => ({
  path: null,
  currentIndex: 0,
  timeSinceReplan: Infinity,
  stuckTime: 0
})

export const buildNavigationGrid = (mazeGrid: MazeGrid): Grid => {
  const base = logicCreateGrid(NAVIGATION_GRID_CONFIG)

  // Mark all wall-corner intersections (odd x, odd z) as impassable
  const withCorners = Array.from({ length: base.height }, (_, gz) =>
    Array.from({ length: base.width }, (_, gx) => ({ gx, gz }))
  )
    .flat()
    .filter(({ gx, gz }) => gx % 2 === 1 && gz % 2 === 1)
    .reduce((grid, { gx, gz }) => logicMarkObstacle(grid, gx, gz), base)

  // Mark east and south walls from maze cell data
  return mazeGrid.flat().reduce((grid, cell) => {
    const gx = cell.col * 2
    const gz = cell.row * 2
    const withEast =
      cell.walls.east && gx + 1 < grid.width ? logicMarkObstacle(grid, gx + 1, gz) : grid
    return cell.walls.south && gz + 1 < grid.height
      ? logicMarkObstacle(withEast, gx, gz + 1)
      : withEast
  }, withCorners)
}

export const computeChaseDirection = (planePos: THREE.Vector3, playerPos: THREE.Vector3): Vec3 => {
  const dx = playerPos.x - planePos.x
  const dz = playerPos.z - planePos.z
  const distance = Math.hypot(dx, dz)
  if (distance < 0.01) return { x: 0, y: 0, z: 0 }
  return { x: dx / distance, y: 0, z: dz / distance }
}

export const spawnPaperPlanes = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  count: number
): Promise<ComplexModel[]> => {
  const half = ISLAND_SIZE / 2 - 4

  const planes = await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const position: [number, number, number] = [
        Math.cos(angle) * half * 0.7,
        3,
        Math.sin(angle) * half * 0.7
      ]
      return getModel(scene, world, PAPER_PLANE_MODEL, {
        ...paperPlaneModelOptions,
        position,
        name: `Paper Plane ${i + 1}`
      })
    })
  )

  planes.forEach((plane, i) => {
    plane.name = `Paper Plane ${i + 1}`
  })

  return planes
}

// Math.round maps the agent to the nearest grid cell, not the one it just left.
// Math.floor (used by logicWorldToGrid) can pick the cell behind the agent at the
// midpoint between cells, causing A* to route backward on every replan.
const worldToGridNearest = (worldX: number, worldZ: number): Position2D => ({
  x: Math.max(
    0,
    Math.min(
      NAVIGATION_GRID_CONFIG.width - 1,
      Math.round(
        (worldX - NAVIGATION_GRID_CONFIG.centerOffset[0]) / NAVIGATION_GRID_CONFIG.cellSize +
          NAVIGATION_GRID_CONFIG.width / 2
      )
    )
  ),
  z: Math.max(
    0,
    Math.min(
      NAVIGATION_GRID_CONFIG.height - 1,
      Math.round(
        (worldZ - NAVIGATION_GRID_CONFIG.centerOffset[2]) / NAVIGATION_GRID_CONFIG.cellSize +
          NAVIGATION_GRID_CONFIG.height / 2
      )
    )
  )
})

const findNearestWalkableCell = (pos: Position2D, navGrid: Grid): Position2D => {
  const candidates = [
    pos,
    { x: pos.x - 1, z: pos.z },
    { x: pos.x + 1, z: pos.z },
    { x: pos.x, z: pos.z - 1 },
    { x: pos.x, z: pos.z + 1 },
    { x: pos.x - 1, z: pos.z - 1 },
    { x: pos.x + 1, z: pos.z - 1 },
    { x: pos.x - 1, z: pos.z + 1 },
    { x: pos.x + 1, z: pos.z + 1 }
  ]
  return (
    candidates.find(
      (c) =>
        c.x >= 0 &&
        c.x < navGrid.width &&
        c.z >= 0 &&
        c.z < navGrid.height &&
        logicIsCellWalkable(navGrid.cells[c.z][c.x])
    ) ?? pos
  )
}

const skipReachedWaypoints = (path: Position2D[], worldPos: THREE.Vector3): number => {
  if (path.length <= 1) return 0
  // Always skip path[0]: it's the agent's current grid cell (already occupied/leaving).
  // Math.floor mapping can place it *behind* the agent, causing backward movement.
  const firstUnreached = path.findIndex((wp, i) => {
    if (i === 0) return false
    const [wx, , wz] = logicGridToWorld(wp.x, wp.z, NAVIGATION_GRID_CONFIG)
    return Math.hypot(wx - worldPos.x, wz - worldPos.z) >= PAPER_PLANE_WAYPOINT_REACH_DISTANCE
  })
  return firstUnreached === -1 ? path.length - 1 : firstUnreached
}

export type ChaseOptions = {
  plane: ComplexModel
  playerPosition: THREE.Vector3
  speed: number
  delta: number
  navGrid: Grid
  pathState: PaperPlanePathState
  filterPredicate?: (collider: object) => boolean
}

const computeReplanPath = (
  plane: ComplexModel,
  playerPosition: THREE.Vector3,
  navGrid: Grid,
  pathState: PaperPlanePathState,
  newTimeSinceReplan: number
): { newPath: Position2D[] | null; shouldReplan: boolean } => {
  const shouldReplan = newTimeSinceReplan >= PAPER_PLANE_REPLAN_INTERVAL || !pathState.path
  const newPath = shouldReplan
    ? logicGetBestRoute(
        navGrid,
        findNearestWalkableCell(worldToGridNearest(plane.position.x, plane.position.z), navGrid),
        findNearestWalkableCell(worldToGridNearest(playerPosition.x, playerPosition.z), navGrid)
      )
    : pathState.path
  return { newPath, shouldReplan }
}

const resolveWaypointTarget = (
  newPath: Position2D[] | null,
  baseIndex: number,
  playerPosition: THREE.Vector3
): [number, number] => {
  if (!newPath || newPath.length === 0) return [playerPosition.x, playerPosition.z]
  const waypoint = newPath[baseIndex] ?? newPath[newPath.length - 1]
  const [wx, , wz] = logicGridToWorld(waypoint.x, waypoint.z, NAVIGATION_GRID_CONFIG)
  return [wx, wz]
}

type MovementVector = { dx: number; dz: number; distance: number }

type PlaneMovementOptions = {
  plane: ComplexModel
  movement: MovementVector
  speed: number
  delta: number
  filterPredicate?: (collider: object) => boolean
}

const applyPlaneMovement = ({
  plane,
  movement,
  speed,
  delta,
  filterPredicate
}: PlaneMovementOptions): void => {
  const { dx, dz, distance } = movement
  const targetAngle = Math.atan2(dx, -dz)
  const rawDiff = targetAngle - plane.rotation.y
  // Normalize to [-PI, PI] to always take the shortest arc
  const angleDiff = rawDiff - Math.PI * 2 * Math.floor((rawDiff + Math.PI) / (Math.PI * 2))
  plane.rotation.y +=
    Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), PAPER_PLANE_TURN_SPEED * delta)
  moveController(
    plane,
    { x: (dx / distance) * speed * delta, y: 0, z: (dz / distance) * speed * delta },
    filterPredicate
  )
}

type PathfinderEventOptions = {
  shouldReplan: boolean
  canAdvance: boolean
  newPath: Position2D[] | null
  baseIndex: number
  newIndex: number
  distance: number
}

const logPathfinderEvent = (
  plane: ComplexModel,
  { shouldReplan, canAdvance, newPath, baseIndex, newIndex, distance }: PathfinderEventOptions
): void => {
  if (shouldReplan) {
    console.warn('[pathfinder] REPLAN', {
      pos: `(${plane.position.x.toFixed(1)}, ${plane.position.z.toFixed(1)})`,
      pathLen: newPath?.length ?? 0,
      startIndex: baseIndex
    })
  } else if (canAdvance) {
    console.warn('[pathfinder] ADVANCE', {
      from: baseIndex,
      to: newIndex,
      distWas: distance.toFixed(2)
    })
  }
}

type StuckStateOptions = {
  newStuckTime: number
  baseIndex: number
  newPath: Position2D[] | null
  distance: number
  targetX: number
  targetZ: number
}

const logStuckState = (
  plane: ComplexModel,
  { newStuckTime, baseIndex, newPath, distance, targetX, targetZ }: StuckStateOptions
): void => {
  if (newStuckTime > 1 && Math.round(newStuckTime * 10) % 10 === 0) {
    console.warn('[pathfinder] STUCK', {
      index: baseIndex,
      pathLen: newPath?.length ?? 0,
      distance: distance.toFixed(2),
      pos: `(${plane.position.x.toFixed(1)}, ${plane.position.z.toFixed(1)})`,
      target: `(${targetX.toFixed(1)}, ${targetZ.toFixed(1)})`
    })
  }
}

export const updatePaperPlaneChase = ({
  plane,
  playerPosition,
  speed,
  delta,
  navGrid,
  pathState,
  filterPredicate
}: ChaseOptions): PaperPlanePathState => {
  const newTimeSinceReplan = pathState.timeSinceReplan + delta
  const { newPath, shouldReplan } = computeReplanPath(
    plane,
    playerPosition,
    navGrid,
    pathState,
    newTimeSinceReplan
  )

  const baseIndex =
    shouldReplan && newPath ? skipReachedWaypoints(newPath, plane.position) : pathState.currentIndex

  const [targetX, targetZ] = resolveWaypointTarget(newPath, baseIndex, playerPosition)

  const dx = targetX - plane.position.x
  const dz = targetZ - plane.position.z
  const distance = Math.hypot(dx, dz)

  const atLastWaypoint = !newPath || baseIndex >= newPath.length - 1
  const canAdvance =
    !shouldReplan && !atLastWaypoint && distance < PAPER_PLANE_WAYPOINT_REACH_DISTANCE
  const newIndex = canAdvance ? baseIndex + 1 : baseIndex

  logPathfinderEvent(plane, { shouldReplan, canAdvance, newPath, baseIndex, newIndex, distance })

  // Stuck = not replanning, not progressing through waypoints, and agent barely moving
  const isProgressing =
    shouldReplan || canAdvance || (atLastWaypoint && distance < PAPER_PLANE_WAYPOINT_REACH_DISTANCE)
  const newStuckTime = isProgressing ? 0 : pathState.stuckTime + delta

  logStuckState(plane, { newStuckTime, baseIndex, newPath, distance, targetX, targetZ })

  if (distance > 0.01) {
    applyPlaneMovement({ plane, movement: { dx, dz, distance }, speed, delta, filterPredicate })
  }

  return {
    path: newPath,
    currentIndex: newIndex,
    timeSinceReplan: shouldReplan ? 0 : newTimeSinceReplan,
    stuckTime: newStuckTime
  }
}

export const checkPaperPlaneCatch = (
  playerPos: THREE.Vector3,
  planes: ComplexModel[],
  radius: number
): boolean =>
  planes.some((plane) => {
    const dx = plane.position.x - playerPos.x
    const dz = plane.position.z - playerPos.z
    return dx * dx + dz * dz <= radius * radius
  })
