import * as THREE from "three";
import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, ModelOptions } from "@webgamekit/threejs";

// Island
export const ISLAND_SIZE = 40;
export const ISLAND_HEIGHT = 0.5;
export const ISLAND_COLOR = 0xc2b280;
export const WATER_SIZE = 200;
export const WATER_Y = -0.3;

// Walls
export const WALL_CELL_SIZE = 4;
export const WALL_SCALE: CoordinateTuple = [0.15, 0.15, 0.15];

// Player
export const PLAYER_SPEED = 20;
export const PLAYER_DISTANCE = 0.5;
export const IDLE_ANIMATION_SPEED = 5;
export const PLAYER_MODEL = "character2.fbx";
export const PLAYER_ANIMATIONS = [
  "animations/walk2.fbx",
  "animations/idle.fbx",
  "animations/running.fbx",
];
export const PLAYER_START: CoordinateTuple = [0, 0.5, 0];

export const playerModelOptions: ModelOptions = {
  position: PLAYER_START,
  scale: [0.01, 0.01, 0.01] as CoordinateTuple,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  boundary: 2,
  animations: PLAYER_ANIMATIONS,
};

export const playerMovement = {
  requireGround: false,
  maxGroundDistance: 5,
  maxStepHeight: 0.5,
  characterRadius: 2,
};

// Enemies
export const WASP_COUNT = 3;
export const WASP_SPEED = 4;
export const WASP_MODEL = "wasp.glb";
export const CATCH_RADIUS = 2;

export const waspModelOptions: ModelOptions = {
  scale: [2, 2, 2] as CoordinateTuple,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  boundary: 1,
};

// Coins
export const COLLECTION_RADIUS = 3;
export const COIN_SPIN_SPEED = 2;
export const COIN_POSITIONS: CoordinateTuple[] = [
  [8, 1, 8],
  [-8, 1, -8],
  [12, 1, -4],
  [-12, 1, 4],
  [0, 1, 14],
  [0, 1, -14],
  [10, 1, 10],
  [-10, 1, -10],
];

// Camera
export const CAMERA_OFFSET: CoordinateTuple = [20, 25, 20];

// Scene setup
export const setupConfig: SetupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 0, 0),
    disabled: true,
  },
  camera: {
    position: CAMERA_OFFSET,
    lookAt: [0, 0, 0],
    fov: 35,
    near: 0.1,
    far: 500,
  },
  ground: false,
  sky: { color: 0x87ceeb },
  lights: {
    ambient: { intensity: 0.6 },
    directional: {
      intensity: 1.2,
      position: [20, 30, 20],
      castShadow: true,
    },
  },
};

// Controls
export const controlBindings = {
  mapping: {
    keyboard: {
      a: "move-left",
      d: "move-right",
      w: "move-up",
      s: "move-down",
    },
    gamepad: {
      "dpad-left": "move-left",
      "dpad-right": "move-right",
      "dpad-down": "move-down",
      "dpad-up": "move-up",
      "axis0-left": "move-left",
      "axis0-right": "move-right",
      "axis1-up": "move-up",
      "axis1-down": "move-down",
    },
  },
  axisThreshold: 0.5,
};

// Config panel schema
export const configControls = {
  player: {
    speed: { min: 5, max: 60, step: 1, label: "Player Speed" },
  },
  wasp: {
    speed: { min: 1, max: 20, step: 0.5, label: "Wasp Speed" },
  },
};

/**
 * Generate perimeter wall positions for the island.
 * Returns positions along the edges of a square island, avoiding corners.
 */
export const generateWallPositions = (
  islandSize: number,
  cellSize: number
): CoordinateTuple[] => {
  const half = islandSize / 2;
  const count = Math.floor(islandSize / cellSize);

  return Array.from({ length: count }, (_, i) => {
    const offset = -half + i * cellSize + cellSize / 2;
    return [
      [offset, 0.5, -half] as CoordinateTuple,
      [offset, 0.5, half] as CoordinateTuple,
      [-half, 0.5, offset] as CoordinateTuple,
      [half, 0.5, offset] as CoordinateTuple,
    ];
  }).flat();
};
