import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, moveController, type ComplexModel, type Vec3 } from '@webgamekit/threejs';
import { checkObstacles } from '@webgamekit/animation';
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
  WASP_MODEL,
  waspModelOptions,
  ISLAND_SIZE,
  MAZE_CELL_SIZE,
  WASP_COLLISION_DISTANCE,
  WASP_REPLAN_INTERVAL,
  WASP_WAYPOINT_REACH_DISTANCE,
} from '../config';
import type { DeskMazeData } from './island';

const NAVIGATION_GRID_CELLS = Math.floor(ISLAND_SIZE / MAZE_CELL_SIZE);
const NAVIGATION_GRID_CONFIG: GridConfig = {
  width: NAVIGATION_GRID_CELLS,
  height: NAVIGATION_GRID_CELLS,
  cellSize: MAZE_CELL_SIZE,
  centerOffset: [0, 0, 0],
};

export interface WaspPathState {
  path: Position2D[] | null;
  currentIndex: number;
  timeSinceReplan: number;
}

export const createInitialWaspPathState = (): WaspPathState => ({
  path: null,
  currentIndex: 0,
  timeSinceReplan: Infinity,
});

export const buildNavigationGrid = (mazeData: DeskMazeData[]): Grid =>
  mazeData.reduce(
    (grid, { deskPos, segments }) =>
      segments.reduce((g, { position: [wx, , wz] }) => {
        const worldPos: [number, number, number] = [deskPos[0] + wx, 0, deskPos[2] + wz];
        const gridPos = logicWorldToGrid(worldPos, NAVIGATION_GRID_CONFIG);
        if (gridPos.x < 0 || gridPos.x >= grid.width || gridPos.z < 0 || gridPos.z >= grid.height) return g;
        return logicMarkObstacle(g, gridPos.x, gridPos.z);
      }, grid),
    logicCreateGrid(NAVIGATION_GRID_CONFIG)
  );

export const computeChaseDirection = (
  waspPos: THREE.Vector3,
  playerPos: THREE.Vector3
): Vec3 => {
  const dx = playerPos.x - waspPos.x;
  const dz = playerPos.z - waspPos.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.01) return { x: 0, y: 0, z: 0 };
  return { x: dx / distance, y: 0, z: dz / distance };
};

export const spawnWasps = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  count: number
): Promise<ComplexModel[]> => {
  const half = ISLAND_SIZE / 2 - 4;

  const wasps = await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const position: [number, number, number] = [
        Math.cos(angle) * half * 0.7,
        3,
        Math.sin(angle) * half * 0.7,
      ];
      return getModel(scene, world, WASP_MODEL, {
        ...waspModelOptions,
        position,
        name: `Wasp ${i + 1}`,
      });
    })
  );

  wasps.forEach((wasp, i) => {
    wasp.name = `Wasp ${i + 1}`;
  });

  return wasps;
};

export const updateWaspChase = (
  wasp: ComplexModel,
  playerPosition: THREE.Vector3,
  speed: number,
  delta: number,
  obstacles: ComplexModel[],
  navGrid: Grid,
  pathState: WaspPathState,
): WaspPathState => {
  const newTimeSinceReplan = pathState.timeSinceReplan + delta;
  const shouldReplan = newTimeSinceReplan >= WASP_REPLAN_INTERVAL || !pathState.path;

  const newPath = shouldReplan
    ? logicGetBestRoute(
        navGrid,
        logicWorldToGrid([wasp.position.x, 0, wasp.position.z], NAVIGATION_GRID_CONFIG),
        logicWorldToGrid([playerPosition.x, 0, playerPosition.z], NAVIGATION_GRID_CONFIG)
      )
    : pathState.path;

  const baseIndex = shouldReplan ? 0 : pathState.currentIndex;

  const [targetX, targetZ] = (() => {
    if (!newPath || newPath.length === 0) return [playerPosition.x, playerPosition.z];
    const waypoint = newPath[baseIndex] ?? newPath[newPath.length - 1];
    const [wx, , wz] = logicGridToWorld(waypoint.x, waypoint.z, NAVIGATION_GRID_CONFIG);
    return [wx, wz];
  })();

  const dx = targetX - wasp.position.x;
  const dz = targetZ - wasp.position.z;
  const distance = Math.hypot(dx, dz);

  const newIndex = !shouldReplan && newPath && distance < WASP_WAYPOINT_REACH_DISTANCE
    ? Math.min(baseIndex + 1, newPath.length - 1)
    : baseIndex;

  if (distance > 0.01) {
    wasp.rotation.y = Math.atan2(dx, -dz);
    const movementDirection = new THREE.Vector3(dx / distance, 0, dz / distance);
    const { canMove } = checkObstacles(wasp.position, movementDirection, obstacles, WASP_COLLISION_DISTANCE);
    if (canMove) {
      moveController(wasp, {
        x: (dx / distance) * speed * delta,
        y: 0,
        z: (dz / distance) * speed * delta,
      });
    }
  }

  return {
    path: newPath,
    currentIndex: newIndex,
    timeSinceReplan: shouldReplan ? 0 : newTimeSinceReplan,
  };
};

export const checkWaspCatch = (
  playerPos: THREE.Vector3,
  wasps: ComplexModel[],
  radius: number
): boolean =>
  wasps.some((wasp) => {
    const dx = wasp.position.x - playerPos.x;
    const dz = wasp.position.z - playerPos.z;
    return dx * dx + dz * dz <= radius * radius;
  });
