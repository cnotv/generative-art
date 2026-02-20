export type NumberTriple = [number, number, number];

export type CellType = "empty" | "boulder" | "gravel" | "wormholeEntrance" | "wormholeExit";

export type GridCell = {
  x: number;
  z: number;
  type: CellType;
};

export type Grid = {
  cells: GridCell[][];
  width: number;
  height: number;
  cellSize: number;
};

export type GridConfig = {
  width: number;
  height: number;
  cellSize: number;
  centerOffset: NumberTriple;
};

export type Position2D = { x: number; z: number };

export type Waypoint = { x: number; y: number; z: number };

export type PathFollowState = {
  waypoints: Waypoint[];
  currentIndex: number;
  /** Normalised progress within the current segment, 0–1. */
  progress: number;
};

export type PathFollowResult = {
  position: Waypoint;
  /** Y-axis rotation in radians facing the direction of travel. */
  rotation: number;
  state: PathFollowState;
  isComplete: boolean;
};
