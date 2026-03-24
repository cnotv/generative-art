import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { getModel, getWalls, type ComplexModel } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/animation';
import {
  ISLAND_SIZE,
  OFFICE_WALL_HEIGHT,
  DESK_MODEL,
  DESK_MODEL_SCALE,
  DESK_POSITIONS,
} from '../config';

export const createOfficeWalls = (scene: THREE.Scene, world: RAPIER.World): THREE.Group =>
  getWalls(scene, world, { name: 'office-wall', length: ISLAND_SIZE, height: OFFICE_WALL_HEIGHT });

export const createDeskModels = (
  scene: THREE.Scene,
  world: RAPIER.World
): Promise<ComplexModel[]> =>
  Promise.all(
    DESK_POSITIONS.map((position: CoordinateTuple, i) =>
      getModel(scene, world, DESK_MODEL, {
        scale: DESK_MODEL_SCALE,
        position,
        type: 'fixed',
        hasGravity: false,
        castShadow: true,
        receiveShadow: true,
        name: `Desk ${i + 1}`,
      })
    )
  );
