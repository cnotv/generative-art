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
  isOpening: boolean;
  isClosing: boolean;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

type MixerFinishedEvent = { action: THREE.AnimationAction; direction: number };

const getOpenAction = (model: ComplexModel): THREE.AnimationAction | undefined => {
  const actions = model.userData.actions as Record<string, THREE.AnimationAction> | undefined;
  return actions ? Object.values(actions)[0] : undefined;
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
  return { model, isOpen: false, isOpening: false, isClosing: false, closeTimer: null };
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
  if (elevator.isOpen || elevator.isOpening || elevator.isClosing) return;
  if (elevator.closeTimer !== null) { clearTimeout(elevator.closeTimer); elevator.closeTimer = null; }
  elevator.isOpen = true;
  elevator.isOpening = true;
  elevator.isClosing = false;

  const action = getOpenAction(elevator.model);
  const mixer = elevator.model.userData.mixer as THREE.AnimationMixer | undefined;

  if (!action || !mixer) {
    elevator.isOpening = false;
    onComplete?.();
    return;
  }

  const allActions = Object.values(elevator.model.userData.actions as Record<string, THREE.AnimationAction>);
  allActions.forEach((a) => a.stop());

  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.timeScale = 3;
  action.reset().play();

  let completed = false;
  const fireOnce = () => {
    if (completed) return;
    completed = true;
    elevator.isOpening = false;
    elevator.closeTimer = setTimeout(() => closeElevator(elevator), ELEVATOR_CLOSE_DELAY * 1000);
    onComplete?.();
  };

  const handler = ({ action: finished }: MixerFinishedEvent) => {
    if (finished === action) {
      mixer.removeEventListener('finished', handler as THREE.EventListener<MixerFinishedEvent, 'finished', THREE.AnimationMixer>);
      fireOnce();
    }
  };
  mixer.addEventListener('finished', handler as THREE.EventListener<MixerFinishedEvent, 'finished', THREE.AnimationMixer>);
  setTimeout(fireOnce, (ELEVATOR_OPEN_FALLBACK_DELAY / 3) * 1000);
};

export const closeElevator = (elevator: ElevatorState): void => {
  if (!elevator.isOpen) return;
  if (elevator.closeTimer !== null) { clearTimeout(elevator.closeTimer); elevator.closeTimer = null; }
  elevator.isOpen = false;
  elevator.isOpening = false;
  elevator.isClosing = true;

  const mixer = elevator.model.userData.mixer as THREE.AnimationMixer | undefined;
  if (!mixer) { elevator.isClosing = false; return; }

  const openAction = getOpenAction(elevator.model);
  if (!openAction) { elevator.isClosing = false; return; }

  const allActions = Object.values(elevator.model.userData.actions as Record<string, THREE.AnimationAction>);
  allActions.forEach((a) => a.stop());

  openAction.setLoop(THREE.LoopOnce, 1);
  openAction.clampWhenFinished = true;
  openAction.timeScale = -3;
  openAction.time = openAction.getClip().duration;
  openAction.play();

  let completed = false;
  const fireOnce = () => {
    if (completed) return;
    completed = true;
    elevator.isClosing = false;
  };

  const handler = ({ action: finished }: MixerFinishedEvent) => {
    if (finished === openAction) {
      mixer.removeEventListener('finished', handler as THREE.EventListener<MixerFinishedEvent, 'finished', THREE.AnimationMixer>);
      fireOnce();
    }
  };
  mixer.addEventListener('finished', handler as THREE.EventListener<MixerFinishedEvent, 'finished', THREE.AnimationMixer>);
  setTimeout(fireOnce, (openAction.getClip().duration + 0.5) * 1000);
};

export const updateElevatorMixer = (elevator: ElevatorState, delta: number): void => {
  (elevator.model.userData.mixer as THREE.AnimationMixer | undefined)?.update(delta);
};


export const cancelElevatorClose = (elevator: ElevatorState): void => {
  if (elevator.closeTimer === null) return;
  clearTimeout(elevator.closeTimer);
  elevator.closeTimer = null;
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
