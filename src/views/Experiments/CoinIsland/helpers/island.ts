import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, type ComplexModel } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/animation';
import {
  ISLAND_SIZE,
  WALL_SCALE,
  generateWallPositions,
  WALL_CELL_SIZE,
} from '../config';

export const createWalls = async (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel[]> => {
  const positions = generateWallPositions(ISLAND_SIZE, WALL_CELL_SIZE);
  const wallsGroup = Object.assign(new THREE.Group(), { name: 'Walls' });
  scene.add(wallsGroup);

  const walls = await Promise.all(
    positions.map(async (position: CoordinateTuple, i) => {
      const wall = await getModel(scene, world, 'sand_block.glb', {
        scale: WALL_SCALE,
        restitution: 0,
        position,
        type: 'fixed',
        hasGravity: false,
        castShadow: true,
        receiveShadow: true,
      });
      wall.name = `Wall ${i + 1}`;
      scene.remove(wall);
      wallsGroup.add(wall);
      return wall;
    })
  );

  return walls;
};
