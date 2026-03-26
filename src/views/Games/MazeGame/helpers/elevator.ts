import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, type ComplexModel } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/animation';
import {
  ELEVATOR_MODEL,
  ELEVATOR_MODEL_SCALE,
  ELEVATOR_PHYSICS_SIZE,
  ELEVATOR_Y,
  ELEVATOR_CLOSE_DELAY,
  ELEVATOR_OPEN_FALLBACK_DELAY,
  ELEVATOR_START_COLOR,
  ELEVATOR_EXIT_COLOR,
  ISLAND_SIZE,
  MAZE_ENTRANCE_OFFSET,
  SHELF_WALL_GAP,
} from '../config';

export interface ElevatorState {
  model: ComplexModel;
  isOpen: boolean;
  autoCloseTimer: number;
}

type MixerFinishedEvent = { action: THREE.AnimationAction; direction: number };

const getOpenAction = (model: ComplexModel): THREE.AnimationAction | undefined => {
  const actions = model.userData.actions as Record<string, THREE.AnimationAction> | undefined;
  return actions ? Object.values(actions)[0] : undefined;
};

const getCloseAction = (model: ComplexModel): THREE.AnimationAction | undefined => {
  const actions = model.userData.actions as Record<string, THREE.AnimationAction> | undefined;
  if (!actions) return undefined;
  const all = Object.values(actions);
  return all.length > 1 ? all[1] : all[0];
};

const tintModel = (model: ComplexModel, color: THREE.ColorRepresentation): void => {
  const tintColor = new THREE.Color(color);
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mat = (child.material as THREE.MeshStandardMaterial).clone();
    mat.color.multiply(tintColor);
    child.material = mat;
  });
};

const createElevator = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  position: CoordinateTuple,
  rotationY: number,
  name: string,
): Promise<ElevatorState> => {
  // getAnimationsModel calls rotateOnAxis(Y, π) after applying the initial rotation.
  // Pre-compensate by subtracting π so the final rotation equals rotationY.
  const model = await getModel(scene, world, ELEVATOR_MODEL, {
    scale: ELEVATOR_MODEL_SCALE,
    position,
    rotation: [0, rotationY - Math.PI, 0] as CoordinateTuple,
    size: ELEVATOR_PHYSICS_SIZE,
    boundary: 1,
    type: 'fixed',
    hasGravity: false,
    castShadow: true,
    receiveShadow: true,
  });
  model.name = name;
  console.warn('[elevator] animation clips:', Object.keys(model.userData.actions ?? {}));
  return { model, isOpen: false, autoCloseTimer: 0 };
};

export const createStartElevator = async (
  scene: THREE.Scene,
  world: RAPIER.World,
): Promise<ElevatorState> => {
  const half = ISLAND_SIZE / 2;
  const state = await createElevator(
    scene,
    world,
    [-MAZE_ENTRANCE_OFFSET, ELEVATOR_Y, -half + SHELF_WALL_GAP] as CoordinateTuple,
    0,
    'StartElevator',
  );
  tintModel(state.model, ELEVATOR_START_COLOR);
  return state;
};

export const createExitElevator = async (
  scene: THREE.Scene,
  world: RAPIER.World,
): Promise<ElevatorState> => {
  const half = ISLAND_SIZE / 2;
  const state = await createElevator(
    scene,
    world,
    [MAZE_ENTRANCE_OFFSET, ELEVATOR_Y, half - SHELF_WALL_GAP] as CoordinateTuple,
    Math.PI,
    'ExitElevator',
  );
  tintModel(state.model, ELEVATOR_EXIT_COLOR);
  return state;
};

export const openElevator = (elevator: ElevatorState, onComplete?: () => void): void => {
  if (elevator.isOpen) return;
  elevator.isOpen = true;
  elevator.autoCloseTimer = 0;

  const action = getOpenAction(elevator.model);
  const mixer = elevator.model.userData.mixer as THREE.AnimationMixer | undefined;

  if (!action || !mixer) {
    console.warn('[elevator] openElevator: no action or mixer found');
    onComplete?.();
    return;
  }

  action.stop();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.timeScale = 1;
  action.reset().play();

  if (onComplete) {
    let completed = false;
    const fireOnce = () => {
      if (completed) return;
      completed = true;
      onComplete();
    };

    const handler = ({ action: finished }: MixerFinishedEvent) => {
      if (finished === action) {
        mixer.removeEventListener('finished', handler as THREE.EventListener<MixerFinishedEvent, 'finished', THREE.AnimationMixer>);
        fireOnce();
      }
    };
    mixer.addEventListener('finished', handler as THREE.EventListener<MixerFinishedEvent, 'finished', THREE.AnimationMixer>);
    setTimeout(fireOnce, ELEVATOR_OPEN_FALLBACK_DELAY * 1000);
  }
};

export const closeElevator = (elevator: ElevatorState): void => {
  if (!elevator.isOpen) return;
  elevator.isOpen = false;
  elevator.autoCloseTimer = 0;

  const mixer = elevator.model.userData.mixer as THREE.AnimationMixer | undefined;
  if (!mixer) return;

  const closeAction = getCloseAction(elevator.model);
  if (!closeAction) return;

  const allActions = Object.values(elevator.model.userData.actions as Record<string, THREE.AnimationAction>);
  const hasSeparateCloseAnim = allActions.length > 1;

  if (hasSeparateCloseAnim) {
    closeAction.stop();
    closeAction.setLoop(THREE.LoopOnce, 1);
    closeAction.clampWhenFinished = true;
    closeAction.reset().play();
  } else {
    // Reverse the open animation
    closeAction.stop();
    closeAction.setLoop(THREE.LoopOnce, 1);
    closeAction.clampWhenFinished = true;
    closeAction.timeScale = -1;
    closeAction.time = closeAction.getClip().duration;
    closeAction.play();
  }
};

export const updateElevatorMixer = (elevator: ElevatorState, delta: number): void => {
  (elevator.model.userData.mixer as THREE.AnimationMixer | undefined)?.update(delta);
};

export const updateElevatorAutoClose = (
  elevator: ElevatorState,
  delta: number,
  closeDelay: number = ELEVATOR_CLOSE_DELAY,
): void => {
  if (!elevator.isOpen) return;
  elevator.autoCloseTimer += delta;
  if (elevator.autoCloseTimer >= closeDelay) {
    closeElevator(elevator);
  }
};

export const isPlayerNearElevator = (
  playerPos: THREE.Vector3,
  elevator: ElevatorState,
  radius: number,
): boolean => {
  const dx = playerPos.x - elevator.model.position.x;
  const dz = playerPos.z - elevator.model.position.z;
  return Math.hypot(dx, dz) <= radius;
};
