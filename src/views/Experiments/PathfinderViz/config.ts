import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig } from "@webgamekit/threejs";
import { CameraPreset } from "@webgamekit/threejs";
import type { GridConfig } from "./helpers/grid";

export const gridConfig: GridConfig = {
  width: 16,
  height: 16,
  cellSize: 2,
  centerOffset: [0, 0, 0] as CoordinateTuple,
};

const COLOR_OBSTACLE_RED = 0xff6b6b;
const COLOR_OBSTACLE_TEAL = 0x4ecdc4;
const COLOR_OBSTACLE_BLUE = 0x45b7d1;
const COLOR_OBSTACLE_YELLOW = 0xf7dc6f;
const COLOR_OBSTACLE_MINT = 0xa8e6cf;
const COLOR_START = 0x2ecc71;
const COLOR_GOAL = 0xe74c3c;
const COLOR_PATH = 0xf39c12;
const COLOR_CHARACTER = 0xffffff;
const COLOR_GROUND = 0x2c3e50;
const COLOR_SKY = 0x1a1a2e;
const COLOR_LIGHT = 0xffffff;

export const obstacleColors: number[] = [
  COLOR_OBSTACLE_RED,
  COLOR_OBSTACLE_TEAL,
  COLOR_OBSTACLE_BLUE,
  COLOR_OBSTACLE_YELLOW,
  COLOR_OBSTACLE_MINT,
];
export const startColor = COLOR_START;
export const goalColor = COLOR_GOAL;
export const pathColor = COLOR_PATH;
export const characterColor = COLOR_CHARACTER;

const DEFAULT_DENSITY = 0.2;
export const obstacleDensity = DEFAULT_DENSITY;

export const characterSettings = {
  model: {
    position: [0, -1, 0] as CoordinateTuple,
    rotation: [0, 0, 0] as CoordinateTuple,
    scale: [1, 1, 1] as CoordinateTuple,
    hasGravity: false,
    castShadow: true,
    material: "MeshLambertMaterial",
    color: characterColor,
  },
};

const CAMERA_HEIGHT = 50;
const GROUND_SIZE = 200;
const AMBIENT_INTENSITY = 1.5;
const DIRECTIONAL_INTENSITY = 2;
const DIRECTIONAL_X = 20;
const DIRECTIONAL_Y = 30;
const DIRECTIONAL_POSITION: CoordinateTuple = [DIRECTIONAL_X, DIRECTIONAL_Y, DIRECTIONAL_X];

export const setupConfig: SetupConfig = {
  camera: {
    position: [0, CAMERA_HEIGHT, 0] as CoordinateTuple,
    lookAt: [0, 0, 0] as CoordinateTuple,
  },
  ground: {
    color: COLOR_GROUND,
    size: [GROUND_SIZE, 1, GROUND_SIZE],
  },
  sky: { color: COLOR_SKY },
  lights: {
    ambient: { color: COLOR_LIGHT, intensity: AMBIENT_INTENSITY },
    directional: {
      color: COLOR_LIGHT,
      intensity: DIRECTIONAL_INTENSITY,
      position: DIRECTIONAL_POSITION,
    },
  },
  orbit: { disabled: true },
};

export const cameraPreset = CameraPreset.TopDown;

const CELL_FOOTPRINT = 1.8;
const MARKER_HEIGHT = 0.2;
const OBSTACLE_HEIGHT = 2;
const FRAMES_PER_GRID_CELL = 40;

export const markerSize: CoordinateTuple = [CELL_FOOTPRINT, MARKER_HEIGHT, CELL_FOOTPRINT];
export const obstacleSize: CoordinateTuple = [CELL_FOOTPRINT, OBSTACLE_HEIGHT, CELL_FOOTPRINT];
export const framesPerCell = FRAMES_PER_GRID_CELL;

export const configControls = {
  obstacles: {
    density: { min: 0.05, max: 0.5, step: 0.05 },
  },
  grid: {
    width: { min: 8, max: 24, step: 2 },
    height: { min: 8, max: 24, step: 2 },
  },
};

export const sceneControls = {
  camera: {
    preset: {
      label: "Camera Preset",
      options: ["top-down", "perspective", "orthographic", "orbit"],
    },
  },
};

// Start and goal positions as grid cell indices (corners of the grid)
export const defaultStart = { x: 1, z: 1 };
export const defaultGoal = (gridWidth: number, gridHeight: number) => ({
  x: gridWidth - 2,
  z: gridHeight - 2,
});
