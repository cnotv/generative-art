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
  MAZE_CELL_SIZE,
  SHELF_MODEL,
  SHELF_MODEL_SCALE,
  SHELF_WALL_GAP,
  PLAYER_START,
  MAZE_EXIT_POSITION,
  MARKER_SIZE,
  MARKER_HEIGHT,
  MARKER_START_COLOR,
  MARKER_END_COLOR,
} from '../config';
import { generateMazeAndSegments, type MazeWallSegment, type MazeGrid } from './maze';

export const createIslandMaze = async (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<{ walls: ComplexModel[]; segments: MazeWallSegment[]; mazeGrid: MazeGrid; extraBodies: RAPIER.RigidBody[] }> => {
  const { grid: mazeGrid, segments } = generateMazeAndSegments(ISLAND_SIZE, MAZE_CELL_SIZE);
  const half = ISLAND_SIZE / 2;
  const innerSegments = segments.filter(({ position }) =>
    Math.abs(position[0]) < half && Math.abs(position[2]) < half
  );

  const extraBodies: RAPIER.RigidBody[] = [];

  const wallObjects = await Promise.all(
    innerSegments.map(async ({ position, horizontal }: MazeWallSegment) => {
      const group = new THREE.Group();
      group.name = 'WallDesk';
      scene.add(group);

      const deskConfigs = horizontal
        ? [
            { x: position[0] - WALL_DESK_SPREAD, z: position[2] - WALL_DESK_OFFSET, ry: Math.PI },
            { x: position[0] + WALL_DESK_SPREAD, z: position[2] - WALL_DESK_OFFSET, ry: Math.PI },
            { x: position[0] - WALL_DESK_SPREAD, z: position[2] + WALL_DESK_OFFSET, ry: 0 },
            { x: position[0] + WALL_DESK_SPREAD, z: position[2] + WALL_DESK_OFFSET, ry: 0 },
          ]
        : [
            { x: position[0] - WALL_DESK_OFFSET, z: position[2] - WALL_DESK_SPREAD, ry: Math.PI / 2 },
            { x: position[0] - WALL_DESK_OFFSET, z: position[2] + WALL_DESK_SPREAD, ry: Math.PI / 2 },
            { x: position[0] + WALL_DESK_OFFSET, z: position[2] - WALL_DESK_SPREAD, ry: -Math.PI / 2 },
            { x: position[0] + WALL_DESK_OFFSET, z: position[2] + WALL_DESK_SPREAD, ry: -Math.PI / 2 },
          ];

      const desks = await Promise.all(
        deskConfigs.map(({ x, z, ry }) =>
          getModel(scene, world, DESK_MODEL, {
            scale: DESK_MODEL_SCALE,
            position: [x, OFFICE_DESK_Y, z] as CoordinateTuple,
            type: 'fixed',
            hasGravity: false,
            castShadow: true,
          }).then((desk) => {
            desk.name = 'Desk';
            desk.rotation.y = ry;
            group.add(desk);
            const { rigidBody } = getPhysic(world, {
              position: desk.position.toArray() as CoordinateTuple,
              size: DESK_PHYSICS_SIZE,
              type: 'fixed',
            });
            extraBodies.push(rigidBody);
            return desk;
          })
        )
      );

      const dividerLength = MAZE_CELL_SIZE - DIVIDER_GAP * 2;
      const divider = getCube(scene, world, {
        position: [position[0], 0, position[2]],
        size: horizontal
          ? [dividerLength, OFFICE_DIVIDER_HEIGHT, OFFICE_DIVIDER_THICKNESS]
          : [OFFICE_DIVIDER_THICKNESS, OFFICE_DIVIDER_HEIGHT, dividerLength],
        color: OFFICE_DIVIDER_COLOR,
        type: 'fixed',
        castShadow: true,
        receiveShadow: true,
      });
      group.add(divider);

      const endDividerSize = WALL_DESK_OFFSET * 2;
      const endOffset = MAZE_CELL_SIZE / 2 - DIVIDER_GAP;
      const endPositions: [number, number, number][] = horizontal
        ? [
            [position[0] - endOffset, 0, position[2]],
            [position[0] + endOffset, 0, position[2]],
          ]
        : [
            [position[0], 0, position[2] - endOffset],
            [position[0], 0, position[2] + endOffset],
          ];
      const endSize: [number, number, number] = horizontal
        ? [OFFICE_DIVIDER_THICKNESS, OFFICE_DIVIDER_HEIGHT, endDividerSize]
        : [endDividerSize, OFFICE_DIVIDER_HEIGHT, OFFICE_DIVIDER_THICKNESS];

      const endDividers = endPositions
        .filter((pos) => Math.abs(pos[0]) < half && Math.abs(pos[2]) < half)
        .map((pos) =>
          getCube(scene, world, {
            position: pos,
            size: endSize,
            color: OFFICE_DIVIDER_COLOR,
            type: 'fixed',
            castShadow: true,
          })
        );
      endDividers.forEach((d) => group.add(d));

      return [...desks, divider, ...endDividers] as ComplexModel[];
    })
  );

  return { walls: wallObjects.flat(), segments, mazeGrid, extraBodies };
};

const WALL_DESK_OFFSET = 3;

const OFFICE_DESK_Y = 0.2;
const OFFICE_DIVIDER_HEIGHT = 3;
const OFFICE_DIVIDER_THICKNESS = 0.2;
const OFFICE_DIVIDER_COLOR = 0xe8ddd0;
const DIVIDER_GAP = 0;
const WALL_DESK_SPREAD = MAZE_CELL_SIZE / 4;

export const createOfficeShelves = async (
  scene: THREE.Scene,
  world: RAPIER.World,
): Promise<ComplexModel[]> => {
  const half = ISLAND_SIZE / 2;
  const count = Math.floor(ISLAND_SIZE / MAZE_CELL_SIZE);
  const positions = Array.from({ length: count }, (_, i) => {
    const offset = -half + i * MAZE_CELL_SIZE + MAZE_CELL_SIZE / 2;
    return offset;
  });

  const shelfY = 4.0;
  const hasPoster = (offset: number) => Math.abs(offset) < 1;

  const wallConfigs = positions.flatMap((offset) => {
    const northShelf = { x: offset, z: -half + SHELF_WALL_GAP, ry: 0, physicsSize: [MAZE_CELL_SIZE / 2, 8, 1] as CoordinateTuple };
    const southShelf = { x: offset, z: half - SHELF_WALL_GAP, ry: Math.PI, physicsSize: [MAZE_CELL_SIZE / 2, 8, 1] as CoordinateTuple };
    const westShelf = { x: -half + SHELF_WALL_GAP, z: offset, ry: Math.PI / 2, physicsSize: [1, 8, MAZE_CELL_SIZE / 2] as CoordinateTuple };
    const eastShelf = { x: half - SHELF_WALL_GAP, z: offset, ry: -Math.PI / 2, physicsSize: [1, 8, MAZE_CELL_SIZE / 2] as CoordinateTuple };
    return [
      hasPoster(offset) ? null : northShelf,
      southShelf,
      hasPoster(offset) ? null : westShelf,
      hasPoster(offset) ? null : eastShelf,
    ].filter((c): c is NonNullable<typeof c> => c !== null);
  });

  const group = new THREE.Group();
  group.name = 'Shelves';
  scene.add(group);

  return Promise.all(
    wallConfigs.map(({ x, z, ry, physicsSize }) =>
      getModel(scene, world, SHELF_MODEL, {
        scale: SHELF_MODEL_SCALE,
        position: [x, shelfY, z] as CoordinateTuple,
        type: 'fixed',
        hasGravity: false,
        castShadow: true,
        receiveShadow: true,
        size: physicsSize,
        boundary: 1,
      }).then((shelf) => {
        shelf.name = 'Shelf';
        shelf.rotation.y = ry;
        group.add(shelf);
        return shelf;
      })
    )
  );
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

export const createLevelMarkers = (scene: THREE.Scene): { disposeMarkers: () => void } => {
  const [sx, , sz] = PLAYER_START as [number, number, number];
  const [ex, , ez] = MAZE_EXIT_POSITION as [number, number, number];

  const makeMarker = (x: number, z: number, color: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(MARKER_SIZE, MARKER_HEIGHT, MARKER_SIZE),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    return mesh;
  };

  const startMarker = makeMarker(sx, sz, MARKER_START_COLOR);
  const endMarker = makeMarker(ex, ez, MARKER_END_COLOR);

  return {
    disposeMarkers: () => {
      scene.remove(startMarker);
      scene.remove(endMarker);
    },
  };
};
