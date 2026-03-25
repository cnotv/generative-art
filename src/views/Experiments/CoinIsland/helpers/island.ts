import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, getWalls, getPhysic, getCube, type ComplexModel } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/animation';
import {
  ISLAND_SIZE,
  OFFICE_WALL_HEIGHT,
  DESK_MODEL,
  DESK_MODEL_SCALE,
  DESK_POSITIONS,
  DESK_PHYSICS_SIZE,
  MAZE_SIZE,
  MAZE_CELL_SIZE,
  MAZE_WALL_HEIGHT,
  MAZE_WALL_THICKNESS,
  MAZE_WALL_COLOR,
} from '../config';
import { generateMazeWallSegments, type MazeWallSegment } from './maze';

export interface DeskMazeData {
  deskPos: CoordinateTuple;
  segments: MazeWallSegment[];
}

export const createMazesAroundDesks = (
  scene: THREE.Scene,
  world: RAPIER.World
): { walls: ComplexModel[]; mazeData: DeskMazeData[] } => {
  const mazeData: DeskMazeData[] = DESK_POSITIONS.map((deskPos) => ({
    deskPos,
    segments: generateMazeWallSegments(MAZE_SIZE, MAZE_CELL_SIZE),
  }));

  const walls = mazeData.flatMap(({ deskPos, segments }) =>
    segments.map(({ position: [wx, , wz], horizontal }) =>
      getCube(scene, world, {
        position: [deskPos[0] + wx, MAZE_WALL_HEIGHT / 2, deskPos[2] + wz],
        size: horizontal
          ? [MAZE_CELL_SIZE, MAZE_WALL_HEIGHT, MAZE_WALL_THICKNESS]
          : [MAZE_WALL_THICKNESS, MAZE_WALL_HEIGHT, MAZE_CELL_SIZE],
        color: MAZE_WALL_COLOR,
        type: 'fixed',
        castShadow: true,
        receiveShadow: true,
      })
    )
  );

  return { walls, mazeData };
};

export const createOfficeWalls = (scene: THREE.Scene, world: RAPIER.World): THREE.Group =>
  getWalls(scene, world, { name: 'office-wall', length: ISLAND_SIZE, height: OFFICE_WALL_HEIGHT });

export const createDeskModels = (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel[]> =>
  Promise.all(
    DESK_POSITIONS.map((position: CoordinateTuple, i) =>
      getModel(scene, world, DESK_MODEL, {
        scale: DESK_MODEL_SCALE,
        position,
        type: 'fixed',
        hasGravity: false,
        castShadow: true,
        receiveShadow: true,
        name: `Desk ${i + 1}`,
      }).then((desk) => {
        getPhysic(world, {
          position: desk.position.toArray() as CoordinateTuple,
          size: DESK_PHYSICS_SIZE,
          type: 'fixed',
        });
        return desk;
      })
    )
  );
