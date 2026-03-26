import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, moveController, type ComplexModel, type Vec3 } from '@webgamekit/threejs';
import {
  logicCreateGrid,
  logicWorldToGrid,
  logicGridToWorld,
  logicMarkObstacle,
  logicGetBestRoute,
  type Grid,
  type GridConfig,
  type Position2D,
} from '@webgamekit/logic';
import {
  PAPER_PLANE_MODEL,
  paperPlaneModelOptions,
  ISLAND_SIZE,
  MAZE_CELL_SIZE,
  PAPER_PLANE_REPLAN_INTERVAL,
  PAPER_PLANE_WAYPOINT_REACH_DISTANCE,
} from '../config';
import type { MazeGrid } from './maze';

// 2x-resolution grid: maze cells at even positions, walls at odd positions.
// With N=10 cells and cellSize=8: grid is 19×19, nav-cellSize=4, centerOffset=[2,0,2].
const NAV_GRID_CELLS = Math.floor(ISLAND_SIZE / MAZE_CELL_SIZE);
const NAV_GRID_SIZE = NAV_GRID_CELLS * 2 - 1;
const NAV_CELL_SIZE = MAZE_CELL_SIZE / 2;
const NAV_CENTER_OFFSET = NAV_CELL_SIZE / 2;

export const NAVIGATION_GRID_CONFIG: GridConfig = {
  width: NAV_GRID_SIZE,
  height: NAV_GRID_SIZE,
  cellSize: NAV_CELL_SIZE,
  centerOffset: [NAV_CENTER_OFFSET, 0, NAV_CENTER_OFFSET],
};

export interface PaperPlanePathState {
  path: Position2D[] | null;
  currentIndex: number;
  timeSinceReplan: number;
  /** Alternates each update: true = move directly to target, false = follow next waypoint */
  useDirectTarget: boolean;
}

export const createInitialPaperPlanePathState = (): PaperPlanePathState => ({
  path: null,
  currentIndex: 0,
  timeSinceReplan: Infinity,
  useDirectTarget: false,
});

export const buildNavigationGrid = (mazeGrid: MazeGrid): Grid => {
  const base = logicCreateGrid(NAVIGATION_GRID_CONFIG);

  // Mark all wall-corner intersections (odd x, odd z) as impassable
  const withCorners = Array.from({ length: base.height }, (_, gz) =>
    Array.from({ length: base.width }, (_, gx) => ({ gx, gz }))
  )
    .flat()
    .filter(({ gx, gz }) => gx % 2 === 1 && gz % 2 === 1)
    .reduce((grid, { gx, gz }) => logicMarkObstacle(grid, gx, gz), base);

  // Mark east and south walls from maze cell data
  return mazeGrid.flat().reduce((grid, cell) => {
    const gx = cell.col * 2;
    const gz = cell.row * 2;
    const withEast =
      cell.walls.east && gx + 1 < grid.width
        ? logicMarkObstacle(grid, gx + 1, gz)
        : grid;
    return cell.walls.south && gz + 1 < grid.height
      ? logicMarkObstacle(withEast, gx, gz + 1)
      : withEast;
  }, withCorners);
};

export const computeChaseDirection = (
  planePos: THREE.Vector3,
  playerPos: THREE.Vector3
): Vec3 => {
  const dx = playerPos.x - planePos.x;
  const dz = playerPos.z - planePos.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.01) return { x: 0, y: 0, z: 0 };
  return { x: dx / distance, y: 0, z: dz / distance };
};

export const spawnPaperPlanes = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  count: number
): Promise<ComplexModel[]> => {
  const half = ISLAND_SIZE / 2 - 4;

  const planes = await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const position: [number, number, number] = [
        Math.cos(angle) * half * 0.7,
        3,
        Math.sin(angle) * half * 0.7,
      ];
      return getModel(scene, world, PAPER_PLANE_MODEL, {
        ...paperPlaneModelOptions,
        position,
        name: `Paper Plane ${i + 1}`,
      });
    })
  );

  planes.forEach((plane, i) => {
    plane.name = `Paper Plane ${i + 1}`;
  });

  return planes;
};

const skipReachedWaypoints = (path: Position2D[], worldPos: THREE.Vector3): number => {
  const firstUnreached = path.findIndex((wp) => {
    const [wx, , wz] = logicGridToWorld(wp.x, wp.z, NAVIGATION_GRID_CONFIG);
    return Math.hypot(wx - worldPos.x, wz - worldPos.z) >= PAPER_PLANE_WAYPOINT_REACH_DISTANCE;
  });
  return firstUnreached === -1 ? path.length - 1 : firstUnreached;
};

export const updatePaperPlaneChase = (
  plane: ComplexModel,
  playerPosition: THREE.Vector3,
  speed: number,
  delta: number,
  navGrid: Grid,
  pathState: PaperPlanePathState,
  filterPredicate?: (collider: object) => boolean,
): PaperPlanePathState => {
  const newTimeSinceReplan = pathState.timeSinceReplan + delta;
  const shouldReplan = newTimeSinceReplan >= PAPER_PLANE_REPLAN_INTERVAL || !pathState.path;

  const newPath = shouldReplan
    ? logicGetBestRoute(
        navGrid,
        logicWorldToGrid([plane.position.x, 0, plane.position.z], NAVIGATION_GRID_CONFIG),
        logicWorldToGrid([playerPosition.x, 0, playerPosition.z], NAVIGATION_GRID_CONFIG)
      )
    : pathState.path;

  const baseIndex = shouldReplan && newPath
    ? skipReachedWaypoints(newPath, plane.position)
    : pathState.currentIndex;

  // Alternate between following the next waypoint and moving directly toward the target.
  // This superset approach breaks oscillation: waypoint mode follows the safe path,
  // direct mode pulls the entity toward the goal when it gets stuck near a node.
  const nextUseDirectTarget = !pathState.useDirectTarget;

  const [targetX, targetZ] = (() => {
    if (pathState.useDirectTarget || !newPath || newPath.length === 0) {
      return [playerPosition.x, playerPosition.z];
    }
    const waypoint = newPath[baseIndex] ?? newPath[newPath.length - 1];
    const [wx, , wz] = logicGridToWorld(waypoint.x, waypoint.z, NAVIGATION_GRID_CONFIG);
    return [wx, wz];
  })();

  const dx = targetX - plane.position.x;
  const dz = targetZ - plane.position.z;
  const distance = Math.hypot(dx, dz);

  const newIndex = !shouldReplan && newPath && !pathState.useDirectTarget && distance < PAPER_PLANE_WAYPOINT_REACH_DISTANCE
    ? Math.min(baseIndex + 1, newPath.length - 1)
    : baseIndex;

  if (distance > 0.01) {
    plane.rotation.y = Math.atan2(dx, -dz);
    moveController(plane, {
      x: (dx / distance) * speed * delta,
      y: 0,
      z: (dz / distance) * speed * delta,
    }, filterPredicate);
  }

  return {
    path: newPath,
    currentIndex: newIndex,
    timeSinceReplan: shouldReplan ? 0 : newTimeSinceReplan,
    useDirectTarget: nextUseDirectTarget,
  };
};

export const checkPaperPlaneCatch = (
  playerPos: THREE.Vector3,
  planes: ComplexModel[],
  radius: number
): boolean =>
  planes.some((plane) => {
    const dx = plane.position.x - playerPos.x;
    const dz = plane.position.z - playerPos.z;
    return dx * dx + dz * dz <= radius * radius;
  });
