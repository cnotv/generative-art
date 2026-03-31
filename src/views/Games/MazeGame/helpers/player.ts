import type RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { getModel, moveController, type ComplexModel } from '@webgamekit/threejs'
import {
  updateAnimation,
  setRotation,
  getRotation,
  getMovementDirection,
  type AnimationData
} from '@webgamekit/animation'
import { PLAYER_MODEL, playerModelOptions, PLAYER_SPEED, PLAYER_DISTANCE } from '../config'

export const createPlayer = async (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel> => {
  const player = await getModel(scene, world, PLAYER_MODEL, playerModelOptions)
  player.name = 'Player'
  return player
}

export const updatePlayerMovement = (
  player: ComplexModel,
  currentActions: Record<string, unknown>,
  getDelta: () => number,
  speed: number = PLAYER_SPEED,
  filterPredicate?: (collider: object) => boolean
): void => {
  const targetRotation = getRotation(currentActions, false)
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
    setRotation(player, targetRotation)
    const { direction } = getMovementDirection(player, 1, false)
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
