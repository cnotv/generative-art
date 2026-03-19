import type { CoordinateTuple } from '@webgamekit/animation';
import type { SetupConfig } from '@webgamekit/threejs';
import * as THREE from 'three';
import type { NoiseConfig, GeneratorConfig, WorldCase } from './types';

export const CAMERA_OFFSET: CoordinateTuple = [0, 10, 25];
export const CHUNK_UPDATE_FREQUENCY = 0.5;
export const CHUNK_SIZE = 50;
export const VIEW_RADIUS = 4;
export const UNLOAD_RADIUS = 5;
export const ELEMENTS_PER_CHUNK = 8;
export const GRASS_PER_CHUNK = 1000;
export const TREES_PER_CHUNK = 6;
export const MOVEMENT_SPEED_SCALE = 1 / 8;
export const GRASS_DENSITY_MULTIPLIER = 200;
export const PLAYER_MODEL_SCALE = 4;

export const noiseConfig: NoiseConfig = {
  seed: 42,
  octaves: 3,
  frequency: 0.004,
  amplitude: 8.5,
  lacunarity: 2.6,
  persistence: 0.7,
};

export const generatorConfig: GeneratorConfig = {
  chunkSize: CHUNK_SIZE,
  elementsPerChunk: ELEMENTS_PER_CHUNK,
  grassPerChunk: GRASS_PER_CHUNK,
  noiseConfig,
};

export const setupConfig: SetupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 0, 0),
    disabled: false,
  },
  camera: {
    position: [0, 10, 25],
    lookAt: [0, 0, 0],
    fov: 75,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 500,
  },
  lights: {
    ambient: { color: 0xffffff, intensity: 0.6 },
    directional: { color: 0xffffff, intensity: 1.2, position: [50, 100, 50] },
  },
  sky: false,
  ground: false,
};

export const TREES_GROUND_COLOR = 0x8b7355;
export const GRASS_GROUND_COLOR = 0x4a7c3f;
export const DIRECTIONAL_LIGHT_OFFSET: CoordinateTuple = [50, 100, 50];
export const AMBIENT_LIGHT_NAME = 'ambient-light';
export const DIRECTIONAL_LIGHT_NAME = 'directional-light';

export const playerSettings = {
  model: {
    path: 'stickboy.glb',
    position: [0, 0, 0] as CoordinateTuple,
    rotation: [0, Math.PI, 0] as CoordinateTuple,
    scale: [PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE] as CoordinateTuple,
    groundOffset: 0.5,
    restitution: -10,
    boundary: 0.5,
    hasGravity: false,
    castShadow: true,
    material: 'MeshLambertMaterial',
    color: 0xff6600,
  },
  movement: {
    requireGround: false,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 20,
    debug: false,
  },
  game: {
    distance: 8,
    speed: {
      movement: 5,
      turning: 4,
      jump: 4,
    },
    maxJump: 4,
  },
};

export const controlBindings = {
  mapping: {
    keyboard: {
      ' ': 'toggle-case',
      a: 'move-left',
      d: 'move-right',
      w: 'move-down',
      s: 'move-up',
    },
    gamepad: {
      cross: 'toggle-case',
      'dpad-left': 'move-left',
      'dpad-right': 'move-right',
      'dpad-down': 'move-down',
      'dpad-up': 'move-up',
      'axis0-left': 'move-left',
      'axis0-right': 'move-right',
      'axis1-up': 'move-up',
      'axis1-down': 'move-down',
    },
    'faux-pad': {
      left: 'move-left',
      right: 'move-right',
      up: 'move-up',
      down: 'move-down',
      click: 'toggle-case',
    },
  },
  axisThreshold: 0.5,
};

export const DEFAULT_WORLD_CASE: WorldCase = 'terrain';

export const densityControl = { min: 1, max: 100, step: 1, label: 'Density' };

export const baseConfigControls = {
  autoWalk: { boolean: true, label: 'Auto Walk' },
  movementSpeed: { min: 0.5, max: 20, step: 0.5, label: 'Speed' },
  chunkSize: { min: 10, max: 200, step: 10, label: 'Chunk Size' },
  viewRadius: { min: 1, max: 10, step: 1, label: 'Load Offset' },
  worldCase: {
    label: 'Case',
    component: 'ButtonSelector' as const,
    queryParam: 'case',
    options: [
      { value: 'terrain', label: 'Terrain' },
      { value: 'trees', label: 'Trees' },
      { value: 'grass', label: 'Grass' },
    ],
  },
  treesGroundColor: { color: true, label: 'Trees Ground Color' },
  grassGroundColor: { color: true, label: 'Grass Ground Color' },
};

export const proceduralConfigControls = {
  procedural: {
    seed: { min: 1, max: 9999, step: 1, label: 'Seed' },
    frequency: { min: 0.001, max: 0.1, step: 0.001, label: 'Frequency' },
    amplitude: { min: 1, max: 30, step: 0.5, label: 'Amplitude' },
    octaves: { min: 1, max: 8, step: 1, label: 'Octaves' },
    lacunarity: { min: 1, max: 4, step: 0.1, label: 'Lacunarity' },
    persistence: { min: 0.1, max: 1, step: 0.05, label: 'Persistence' },
  },
};

export const configControls = {
  ...baseConfigControls,
  ...proceduralConfigControls,
};
