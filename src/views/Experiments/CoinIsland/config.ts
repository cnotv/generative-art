import * as THREE from "three";
import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, ModelOptions } from "@webgamekit/threejs";

// Island
export const ISLAND_SIZE = 80;
export const ISLAND_COLOR = 0xc2b280;

// Walls
export const WALL_CELL_SIZE = 4;
export const WALL_SCALE: CoordinateTuple = [0.02, 0.02, 0.02];
export const OFFICE_WALL_HEIGHT = 10;

// Office models
export const OFFICE_MODEL = "minimal_office.glb";
const OFFICE_SCALE = 0.5;
export const OFFICE_MODEL_SCALE: CoordinateTuple = [OFFICE_SCALE, OFFICE_SCALE, OFFICE_SCALE];
const OFFICE_CORNER = 25;
const OFFICE_SIDE = 28;
const OFFICE_FRONT = 22;
export const OFFICE_POSITIONS: CoordinateTuple[] = [
  [-OFFICE_CORNER, 0, -OFFICE_CORNER],
  [0, 0, -OFFICE_SIDE],
  [OFFICE_CORNER, 0, -OFFICE_CORNER],
  [-OFFICE_SIDE, 0, 0],
  [OFFICE_SIDE, 0, 0],
  [-OFFICE_FRONT, 0, OFFICE_FRONT],
  [OFFICE_FRONT, 0, OFFICE_FRONT],
];

// Player
export const PLAYER_SPEED = 20;
export const PLAYER_DISTANCE = 0.5;
export const PLAYER_MODEL = "stickboy.glb";
export const PLAYER_START: CoordinateTuple = [0, -2, 0];
export const PLAYER_MODEL_SCALE = 2.5;

export const playerModelOptions: ModelOptions = {
  position: PLAYER_START,
  scale: [PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE] as CoordinateTuple,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  boundary: 0.5,
};

export const playerMovement = {
  requireGround: false,
  maxGroundDistance: 5,
  maxStepHeight: 0.5,
  characterRadius: 2,
  collisionDistance: 2,
};

// Enemies
export const WASP_COUNT = 3;
export const WASP_SPEED = 10;
export const WASP_MODEL = "paper_airplane.glb";
export const CATCH_RADIUS = 2;

export const waspModelOptions: ModelOptions = {
  scale: [0.66, 0.66, 0.66] as CoordinateTuple,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  boundary: 1,
};

// Coins
export const COLLECTION_RADIUS = 3;
export const COIN_SPIN_SPEED = 2;
export const COIN_POSITIONS: CoordinateTuple[] = [
  [8, 3, 8],
  [-8, 3, -8],
  [12, 3, -4],
  [-12, 3, 4],
  [0, 3, 14],
  [0, 3, -14],
  [10, 3, 10],
  [-10, 3, -10],
];

// Camera
export const CAMERA_OFFSET: CoordinateTuple = [0, 25, 30];

// Scene setup
export const setupConfig: SetupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 0, 0),
  },
  camera: {
    position: CAMERA_OFFSET,
    lookAt: [0, 0, 0],
    fov: 50,
    near: 0.1,
    far: 500,
  },
  ground: { size: ISLAND_SIZE, color: ISLAND_COLOR },
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
      w: "move-down",
      s: "move-up",
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
