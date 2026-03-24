import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { ComplexModel } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/animation';
import { getCoinBlock } from '@/utils/custom-models';

export const spawnCoins = (
  scene: THREE.Scene,
  world: RAPIER.World,
  positions: CoordinateTuple[]
): ComplexModel[] =>
  positions.map((position, i) => {
    const coin = getCoinBlock(scene, world, { position });
    coin.name = `Coin ${i + 1}`;
    return coin;
  });

export const updateCoinSpin = (
  coins: ComplexModel[],
  delta: number,
  speed: number
): void => {
  coins.forEach((coin) => {
    coin.rotation.z += delta * speed;
  });
};

/**
 * Returns indices of coins within collection radius of the player.
 * Uses XZ distance only (ignores vertical offset).
 */
export const checkCoinCollection = (
  playerPos: THREE.Vector3,
  coins: ComplexModel[],
  radius: number
): number[] => {
  const radiusSquared = radius * radius;
  return coins
    .map((coin, index) => {
      const dx = coin.position.x - playerPos.x;
      const dz = coin.position.z - playerPos.z;
      return dx * dx + dz * dz <= radiusSquared ? index : -1;
    })
    .filter((index) => index !== -1);
};
