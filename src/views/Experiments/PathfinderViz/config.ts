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

// Maze: 5 alternating horizontal walls forcing a snake path
// Gaps alternate: LEFT (x=1-2) → RIGHT (x=12-14) → LEFT → RIGHT → extra blocker
const MAZE_ROW_1 = 3;
const MAZE_ROW_2 = 6;
const MAZE_ROW_3 = 9;
const MAZE_ROW_4 = 12;
const MAZE_LEFT_START = 3;   // left-gap walls start at x=3 (gap: x=1-2)
const MAZE_LEFT_END = 14;
const MAZE_RIGHT_START = 1;  // right-gap walls start at x=1
const MAZE_RIGHT_END = 11;   // right-gap walls end at x=11 (gap: x=12-14)
const MAZE_EXTRA_X = 7;      // extra vertical blocker column
const MAZE_EXTRA_Z_FROM = 3;
const MAZE_EXTRA_Z_TO = 5;

// Corridor: two horizontal walls creating a narrow passage
const CORRIDOR_TOP = 5;
const CORRIDOR_BOT = 10;
const CORRIDOR_FROM = 2;
const CORRIDOR_TO = 13;

// Zigzag: 4 vertical walls with alternating bottom/top gaps
const ZZ_COL_1 = 3;
const ZZ_COL_2 = 6;
const ZZ_COL_3 = 9;
const ZZ_COL_4 = 12;
const ZZ_BOTTOM_FROM = 1;
const ZZ_BOTTOM_TO = 9;    // gap: z=10-14 at bottom
const ZZ_TOP_FROM = 5;
const ZZ_TOP_TO = 14;      // gap: z=1-4 at top

/**
 * Pre-defined obstacle scenarios for demonstration.
 * Each entry maps a scenario name to an array of obstacle positions.
 */
export const scenarios: Record<string, Position[]> = {
  maze: [
    ...makeWall("z", MAZE_ROW_1, MAZE_LEFT_START, MAZE_LEFT_END),
    ...makeWall("z", MAZE_ROW_2, MAZE_RIGHT_START, MAZE_RIGHT_END),
    ...makeWall("z", MAZE_ROW_3, MAZE_LEFT_START, MAZE_LEFT_END),
    ...makeWall("z", MAZE_ROW_4, MAZE_RIGHT_START, MAZE_RIGHT_END),
    ...makeWall("x", MAZE_EXTRA_X, MAZE_EXTRA_Z_FROM, MAZE_EXTRA_Z_TO),
  ],
  corridor: [
    ...makeWall("z", CORRIDOR_TOP, CORRIDOR_FROM, CORRIDOR_TO),
    ...makeWall("z", CORRIDOR_BOT, CORRIDOR_FROM, CORRIDOR_TO),
  ],
  zigzag: [
    ...makeWall("x", ZZ_COL_1, ZZ_BOTTOM_FROM, ZZ_BOTTOM_TO),
    ...makeWall("x", ZZ_COL_2, ZZ_TOP_FROM, ZZ_TOP_TO),
    ...makeWall("x", ZZ_COL_3, ZZ_BOTTOM_FROM, ZZ_BOTTOM_TO),
    ...makeWall("x", ZZ_COL_4, ZZ_TOP_FROM, ZZ_TOP_TO),
  ],
};
