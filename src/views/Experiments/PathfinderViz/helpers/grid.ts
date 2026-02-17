import type { CoordinateTuple } from "@webgamekit/animation";

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
  centerOffset: CoordinateTuple;
};

export const isCellWalkable = (cell: GridCell): boolean => cell.type !== "boulder";

export const createGrid = (config: GridConfig): Grid => ({
  cells: Array.from({ length: config.height }, (_, z) =>
    Array.from({ length: config.width }, (_, x) => ({ x, z, type: "empty" as CellType }))
  ),
  width: config.width,
  height: config.height,
  cellSize: config.cellSize,
});

export const gridToWorld = (
  gridX: number,
  gridZ: number,
  config: GridConfig
): CoordinateTuple => {
  const worldX =
    (gridX - config.width / 2) * config.cellSize + config.centerOffset[0];
  const worldZ =
    (gridZ - config.height / 2) * config.cellSize + config.centerOffset[2];
  return [worldX, config.centerOffset[1], worldZ];
};

export const worldToGrid = (
  worldPos: CoordinateTuple,
  config: GridConfig
): { x: number; z: number } => {
  const gridX = Math.floor(
    (worldPos[0] - config.centerOffset[0]) / config.cellSize +
      config.width / 2
  );
  const gridZ = Math.floor(
    (worldPos[2] - config.centerOffset[2]) / config.cellSize +
      config.height / 2
  );
  return { x: gridX, z: gridZ };
};

export const setCellType = (
  grid: Grid,
  x: number,
  z: number,
  type: CellType
): Grid => ({
  ...grid,
  cells: grid.cells.map((row, rowZ) =>
    row.map((cell, colX) =>
      colX === x && rowZ === z ? { ...cell, type } : cell
    )
  ),
});

export const markObstacle = (grid: Grid, x: number, z: number): Grid =>
  setCellType(grid, x, z, "boulder");

export const markObstacles = (
  grid: Grid,
  positions: { x: number; z: number }[]
): Grid =>
  positions.reduce((accumulator, { x, z }) => markObstacle(accumulator, x, z), grid);
