import type RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { getModel, moveController, type ComplexModel } from '@webgamekit/threejs'
import {
  updateAnimation,
  updatePlayerFacing,
  getMovementDirection,
  type AnimationData
} from '@webgamekit/animation'
import { PLAYER_MODEL, playerModelOptions, PLAYER_SPEED, PLAYER_DISTANCE } from '../config'

/**
 * Loads the player's model.
 * @param scene The scene to add it to.
 * @param world The physics world.
 * @returns The player.
 */
export const createPlayer = async (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel> => {
  const player = await getModel(scene, world, PLAYER_MODEL, playerModelOptions)
  player.name = 'Player'
  return player
}

/**
 * Turns the player to face the pressed direction and moves it through its character controller.
 * @param player The player.
 * @param currentActions The actions held now.
 * @param getDelta Reads seconds since the last frame.
 * @param speed Units per second.
 * @param filterPredicate Says which colliders the player may collide with.
 */
export const updatePlayerMovement = (
  player: ComplexModel,
  currentActions: Record<string, unknown>,
  getDelta: () => number,
  speed: number = PLAYER_SPEED,
  filterPredicate?: (collider: object) => boolean
): void => {
  const targetRotation = updatePlayerFacing(player, currentActions)
  const isMoving = targetRotation !== null
  const delta = getDelta()

  const animationData: AnimationData = {
    actionName: isMoving ? 'walk' : 'idle',
    player,
    delta: delta * 2,
    speed,
    distance: PLAYER_DISTANCE
  }

  if (isMoving) {
    const { direction } = getMovementDirection(player, 1, false, targetRotation)
    moveController(
      player,
      {
        x: direction.x * speed * delta,
        y: 0,
        z: direction.z * speed * delta
      },
      filterPredicate
    )
  }

  updateAnimation(animationData)
}
