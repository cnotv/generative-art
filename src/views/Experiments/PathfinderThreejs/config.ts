import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig } from "@webgamekit/threejs";
import type { GridConfig, CellType } from "./helpers/grid";
import type { Position } from "./helpers/pathfinding";

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0x1a1a2e },
  lights: {
    ambient: { color: 0xffffff, intensity: 1.5 },
    directional: {
      color: 0xffffff,
      intensity: 2,
      position: [20, 30, 20] as CoordinateTuple,
      castShadow: true,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        camera: { near: 0.5, far: 200, left: -30, right: 30, top: 30, bottom: -30 },
        bias: -0.001,
        radius: 1,
      },
    },
  },
  ground: { color: 0x2c3e50, size: 200 },
  sky: false,
  orbit: false,
};

export const gridConfig: GridConfig = {
  width: 16,
  height: 16,
  cellSize: 2,
  centerOffset: [0, 0, 0] as CoordinateTuple,
};

// Sizes
const CELL_FOOTPRINT = 1.8;
const CELL_HEIGHT = 1;
const FRAMES_PER_GRID_CELL = 40;

const COLOR_BOULDER = 0x7f8c8d;
const COLOR_GRAVEL = 0xa07850;
const COLOR_WORMHOLE_ENTRANCE = 0x8e44ad;
const COLOR_WORMHOLE_EXIT = 0x16a085;
const COLOR_START = 0x2ecc71;
const COLOR_GOAL = 0xe74c3c;
const COLOR_PATH = 0xf39c12;
const COLOR_CHARACTER = 0xffffff;

export const cellTypeColors: Record<string, number> = {
  boulder: COLOR_BOULDER,
  gravel: COLOR_GRAVEL,
  wormholeEntrance: COLOR_WORMHOLE_ENTRANCE,
  wormholeExit: COLOR_WORMHOLE_EXIT,
};

export const cellTypeHeights: Record<string, number> = {
  boulder: CELL_HEIGHT,
  gravel: CELL_HEIGHT,
  wormholeEntrance: CELL_HEIGHT,
  wormholeExit: CELL_HEIGHT,
};

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

export const markerSize: CoordinateTuple = [CELL_FOOTPRINT, CELL_HEIGHT, CELL_FOOTPRINT];
export const cellFootprint = CELL_FOOTPRINT;
export const framesPerCell = FRAMES_PER_GRID_CELL;

/** Shared base config for all obstacle cubes — only position, size, and color vary per cell. */
export const obstacleCubeBase = {
  type: "fixed" as const,
  castShadow: true,
  receiveShadow: false,
};

// ── Scenario types ────────────────────────────────────────────────────────────

export type ScenarioCell = { x: number; z: number; type?: CellType };

export type ScenarioConfig = {
  cells: ScenarioCell[];
  start?: Position;
  goal?: Position;
  gridSize?: { width: number; height: number };
};

// ── Config panel schema (flat — no accordion groups) ─────────────────────────

export const configControls = {
  density: { min: 0.05, max: 0.5, step: 0.05, label: "Obstacle Density" },
  width:   { min: 8, max: 24, step: 2, label: "Grid Width" },
  height:  { min: 8, max: 24, step: 2, label: "Grid Height" },
  brush: {
    label: "Brush Type",
    component: "ButtonSelector",
    sectionStart: true,
    options: [
      { value: "boulder",          label: "Boulder",  color: "#7f8c8d" },
      { value: "gravel",           label: "Gravel",   color: "#a07850" },
      { value: "wormholeEntrance", label: "Entrance", color: "#8e44ad" },
      { value: "wormholeExit",     label: "Exit",     color: "#16a085" },
      { value: "start",            label: "Start",    color: "#2ecc71" },
      { value: "goal",             label: "Goal",     color: "#e74c3c" },
      { value: "empty",            label: "Erase" },
    ],
  },
  scenarios: {
    label: "Scenario",
    component: "ButtonSelector",
    sectionStart: true,
    options: [
      { value: "simple",           label: "Simple" },
      { value: "gravel",           label: "Gravel" },
      { value: "blocked",          label: "Blocked" },
      { value: "zig-zag",          label: "Zig-Zag" },
      { value: "warp",             label: "Warp" },
      { value: "warp-blocked",     label: "Warp Blocked" },
      { value: "warp-first",       label: "Warp First" },
      { value: "warp-last",        label: "Warp Last" },
      { value: "warp-best-blocked",label: "Warp Best Blocked" },
      { value: "warp-zig-zag",     label: "Warp Zig-Zag" },
    ],
  },
  showCosts:           { checkbox: false, label: "Show Costs", sectionStart: true },
  generateNewScene:    { callback: "generateNewScene",    label: "New Scene" },
  recalculate:         { callback: "recalculate",         label: "Recalculate" },
  clearObstacles:      { callback: "clearObstacles",      label: "Clear" },
};

export const sceneControls = {
  camera: {
    isometric: { boolean: false, label: "Isometric View" },
  },
};

export const defaultSceneValues = {
  camera: { isometric: false },
};

/** Returns configControls with start/goal brush options disabled when already placed. */
export const buildConfigControls = (hasStart: boolean, hasGoal: boolean) => ({
  ...configControls,
  brush: {
    ...configControls.brush,
    options: configControls.brush.options.map((opt) =>
      opt.value === "start" ? { ...opt, disabled: hasStart }
      : opt.value === "goal" ? { ...opt, disabled: hasGoal }
      : opt
    ),
  },
});

// ── Start / goal helpers ──────────────────────────────────────────────────────

export const defaultStart = { x: 1, z: 1 };
export const defaultGoal = (gridWidth: number, gridHeight: number) => ({
  x: gridWidth - 2,
  z: gridHeight - 2,
});

// ── Scenario wall helpers ─────────────────────────────────────────────────────

/** Generates `count` cells in a column (fixed x, z from 0 to count-1). */
const col = (x: number, count: number): ScenarioCell[] =>
  Array.from({ length: count }, (_, z) => ({ x, z }));

/** Generates `count` cells in a column starting at zFrom. */
const colFrom = (x: number, zFrom: number, count: number): ScenarioCell[] =>
  Array.from({ length: count }, (_, i) => ({ x, z: zFrom + i }));

/** Diagonal cells: (0,0), (1,1), ..., (n-1,n-1). */
const diagonal = (n: number): ScenarioCell[] =>
  Array.from({ length: n }, (_, i) => ({ x: i, z: i }));

/** Row of typed cells from xFrom to xFrom+count-1 at fixed z. */
const typedRow = (z: number, xFrom: number, count: number, type: CellType): ScenarioCell[] =>
  Array.from({ length: count }, (_, i) => ({ x: xFrom + i, z, type }));

// ── Scenario definitions ──────────────────────────────────────────────────────

// 11×11 grid common to all reference scenarios
const REF_GRID = { width: 11, height: 11 };
const REF_START: Position = { x: 0, z: 5 };
const REF_GOAL: Position  = { x: 10, z: 5 };

export const scenarios: Record<string, ScenarioConfig> = {
  // ── Reference 11×11 scenarios ─────────────────────────────────────────────
  /** Straight A→B with no obstacles. */
  simple: {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [],
  },

  /** Straight A→B but the middle row is gravel (higher cost). */
  gravel: {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: typedRow(5, 1, 9, "gravel"),
  },

  /** Full vertical wall at x=5 — no path exists. */
  blocked: {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: col(5, 11),
  },

  /** Three vertical walls forcing a serpentine route. */
  "zig-zag": {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      ...col(2, 10),
      ...colFrom(5, 1, 10),
      ...col(8, 10),
    ],
  },

  /** Wormhole makes the route shorter than walking. */
  warp: {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      { x: 3, z: 5, type: "wormholeEntrance" },
      { x: 7, z: 5, type: "wormholeExit" },
    ],
  },

  /** Normal route is blocked; wormhole crosses the wall. */
  "warp-blocked": {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      ...col(5, 11),
      { x: 3, z: 5, type: "wormholeEntrance" },
      { x: 7, z: 5, type: "wormholeExit" },
    ],
  },

  /** Diagonal wall forces a detour; warp exit is near the goal. */
  "warp-first": {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      ...diagonal(11),
      { x: 9,  z: 10, type: "wormholeEntrance" },
      { x: 1,  z: 0,  type: "wormholeExit" },
    ],
  },

  /** Normal route is cheap and direct; warp exit is inaccessible. */
  "warp-last": {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      { x: 1,  z: 5, type: "wormholeEntrance" },
      { x: 10, z: 4 },
      { x: 9,  z: 4 },
      { x: 9,  z: 3 },
      { x: 9,  z: 2 },
      { x: 10, z: 2 },
      { x: 10, z: 3, type: "wormholeExit" },
    ],
  },

  /** Best warp exit is blocked; diagonal blocks normal routes. */
  "warp-best-blocked": {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      { x: 10, z: 4 },
      { x: 9,  z: 4 },
      { x: 9,  z: 3 },
      { x: 9,  z: 2 },
      { x: 10, z: 2 },
      { x: 10, z: 3, type: "wormholeExit" },
      ...diagonal(11),
      { x: 9,  z: 10, type: "wormholeEntrance" },
      { x: 1,  z: 0,  type: "wormholeExit" },
    ],
  },

  /** Zig-zag walls that a wormhole can skip entirely. */
  "warp-zig-zag": {
    gridSize: REF_GRID,
    start: REF_START,
    goal: REF_GOAL,
    cells: [
      ...col(2, 10),
      ...colFrom(5, 1, 10),
      ...col(8, 10),
      { x: 0,  z: 6, type: "wormholeEntrance" },
      { x: 10, z: 6, type: "wormholeExit" },
    ],
  },
};
