import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { ComplexModel } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import { getCoinBlock } from '@/utils/custom-models'

/**
 * Adds a spinning coin at each position, in a group of their own.
 * @param scene The scene to add them to.
 * @param world The physics world.
 * @param positions Where to put each coin.
 * @returns The coins.
 */
export const spawnCoins = (
  scene: THREE.Scene,
  world: RAPIER.World,
  positions: CoordinateTuple[]
): ComplexModel[] => {
  const group = new THREE.Group()
  group.name = 'Coins'
  scene.add(group)
  return positions.map((position, i) => {
    const coin = getCoinBlock(scene, world, { position })
    coin.name = `Coin ${i + 1}`
    group.add(coin)
    return coin
  })
}

/**
 * Turns every coin a little further about its axis.
 * @param coins The coins.
 * @param delta Seconds since the last frame.
 * @param speed Radians per second.
 */
export const updateCoinSpin = (coins: ComplexModel[], delta: number, speed: number): void => {
  coins.forEach((coin) => {
    coin.rotation.z += delta * speed
  })
}

/**
 * Returns indices of coins within collection radius of the player.
 * Uses XZ distance only (ignores vertical offset).
 * @param playerPos The player's position.
 * @param coins The coins.
 * @param radius The collection radius.
 * @returns The indices of the coins collected.
 */
export const checkCoinCollection = (
  playerPos: THREE.Vector3,
  coins: ComplexModel[],
  radius: number
): number[] => {
  const radiusSquared = radius * radius
  return coins
    .map((coin, index) => {
      const dx = coin.position.x - playerPos.x
      const dz = coin.position.z - playerPos.z
      return dx * dx + dz * dz <= radiusSquared ? index : -1
    })
    .filter((index) => index !== -1)
}
