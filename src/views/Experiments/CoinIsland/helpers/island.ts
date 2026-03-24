import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getCube, getModel, type ComplexModel } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/animation';
import { createWaterMaterial } from '@/views/Experiments/LandingPage/waterShader';
import {
  ISLAND_SIZE,
  ISLAND_HEIGHT,
  ISLAND_COLOR,
  WATER_SIZE,
  WATER_Y,
  WALL_SCALE,
  generateWallPositions,
  WALL_CELL_SIZE,
} from '../config';

export const createIslandGround = (
  scene: THREE.Scene,
  world: RAPIER.World
): ComplexModel =>
  getCube(scene, world, {
    size: [ISLAND_SIZE, ISLAND_HEIGHT, ISLAND_SIZE],
    position: [0, -ISLAND_HEIGHT / 2, 0],
    color: ISLAND_COLOR,
    type: 'fixed',
    receiveShadow: true,
  });

export const createWaterPlane = (scene: THREE.Scene): {
  mesh: THREE.Mesh;
  update: (time: number) => void;
} => {
  const { material, update } = createWaterMaterial();
  const geometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_Y;
  scene.add(mesh);
  return { mesh, update };
};

export const createWalls = async (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel[]> => {
  const positions = generateWallPositions(ISLAND_SIZE, WALL_CELL_SIZE);

  const walls = await Promise.all(
    positions.map((position: CoordinateTuple) =>
      getModel(scene, world, 'sand_block.glb', {
        position,
        scale: WALL_SCALE,
        type: 'fixed',
        hasGravity: false,
        receiveShadow: true,
        castShadow: true,
      })
    )
  );

  return walls;
};
