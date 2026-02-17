import type { CoordinateTuple } from "@webgamekit/animation";
import type { GridConfig } from "./helpers/grid";
import type { Position } from "./helpers/pathfinding";

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

const makeWall = (
  fixed: "x" | "z",
  fixedValue: number,
  from: number,
  to: number
): Position[] =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    fixed === "x"
      ? { x: fixedValue, z: from + i }
      : { x: from + i, z: fixedValue }
  );

const WALL_A = 4;
const WALL_B = 8;
const WALL_C = 12;
const GRID_MID = 8;
const WALL_END_LOW = 7;
const WALL_END_HIGH = 13;
const CORRIDOR_TOP = 6;
const CORRIDOR_BOT = 9;

/**
 * Pre-defined obstacle scenarios for demonstration.
 * Each entry maps a scenario name to an array of obstacle positions.
 */
export const scenarios: Record<string, Position[]> = {
  maze: [
    ...makeWall("x", WALL_A, 2, WALL_END_LOW),
    ...makeWall("x", WALL_B, GRID_MID, WALL_END_HIGH),
    ...makeWall("x", WALL_C, 2, WALL_END_LOW),
  ],
  corridor: [
    ...makeWall("z", CORRIDOR_TOP, 2, WALL_END_HIGH),
    ...makeWall("z", CORRIDOR_BOT, 2, WALL_END_HIGH),
  ],
  zigzag: [
    ...makeWall("z", WALL_A, 2, CORRIDOR_TOP),
    ...makeWall("z", WALL_B, GRID_MID, WALL_END_HIGH),
    ...makeWall("z", WALL_C, 2, CORRIDOR_TOP),
  ],
};
