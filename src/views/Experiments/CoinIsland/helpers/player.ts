import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { getModel, type ComplexModel } from '@webgamekit/threejs';
import {
  controllerForward,
  updateAnimation,
  setRotation,
  getRotation,
  type AnimationData,
} from '@webgamekit/animation';
import {
  PLAYER_MODEL,
  playerModelOptions,
  playerMovement,
  PLAYER_SPEED,
  PLAYER_DISTANCE,
  IDLE_ANIMATION_SPEED,
} from '../config';

export const createPlayer = async (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel> => {
  const player = await getModel(scene, world, PLAYER_MODEL, playerModelOptions);
  player.name = 'Player';
  return player;
};

export const updatePlayerMovement = (
  player: ComplexModel,
  currentActions: Map<string, Set<string>>,
  obstacles: ComplexModel[],
  groundBodies: ComplexModel[],
  getDelta: () => number,
  speed: number = PLAYER_SPEED
): void => {
  const targetRotation = getRotation(currentActions, true);
  const isMoving = targetRotation !== null;
  const actionName = 'Armature|mixamo.com|Layer0';

  const animationData: AnimationData = {
    actionName,
    player,
    delta: getDelta() * 2,
    speed,
    distance: PLAYER_DISTANCE,
  };

  if (isMoving) {
    setRotation(player, targetRotation);
    controllerForward(obstacles, groundBodies, animationData, playerMovement);
  } else {
    updateAnimation({ ...animationData, speed: IDLE_ANIMATION_SPEED });
  }
};
