import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, moveController, type ComplexModel, type Vec3 } from '@webgamekit/threejs';
import { WASP_MODEL, waspModelOptions, ISLAND_SIZE } from '../config';

/**
 * Compute normalized chase direction from wasp to player on the XZ plane.
 * Returns zero vector if positions overlap.
 */
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
        1,
        Math.sin(angle) * half * 0.7,
      ];
      return getModel(scene, world, WASP_MODEL, {
        ...waspModelOptions,
        position,
      });
    })
  );

  return wasps;
};

export const updateWaspChase = (
  wasp: ComplexModel,
  playerPosition: THREE.Vector3,
  speed: number,
  delta: number
): void => {
  const direction = computeChaseDirection(wasp.position, playerPosition);
  const moveVector: Vec3 = {
    x: direction.x * speed * delta,
    y: 0,
    z: direction.z * speed * delta,
  };

  moveController(wasp, moveVector);

  if (direction.x !== 0 || direction.z !== 0) {
    wasp.rotation.y = Math.atan2(direction.x, direction.z);
  }
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
