import type { CellType, Grid, GridCell, GridConfig, NumberTriple, Position2D } from "./types";

export const logicIsCellWalkable = (cell: GridCell): boolean => cell.type !== "boulder";

export const logicCreateGrid = (config: GridConfig): Grid => ({
  cells: Array.from({ length: config.height }, (_, z) =>
    Array.from({ length: config.width }, (_, x) => ({ x, z, type: "empty" as CellType }))
  ),
  width: config.width,
  height: config.height,
  cellSize: config.cellSize,
});

export const logicGridToWorld = (
  gridX: number,
  gridZ: number,
  config: GridConfig
): NumberTriple => {
  const worldX =
    (gridX - config.width / 2) * config.cellSize + config.centerOffset[0];
  const worldZ =
    (gridZ - config.height / 2) * config.cellSize + config.centerOffset[2];
  return [worldX, config.centerOffset[1], worldZ];
};

export const logicWorldToGrid = (
  worldPos: NumberTriple,
  config: GridConfig
): Position2D => {
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

export const logicSetCellType = (
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

export const logicMarkObstacle = (grid: Grid, x: number, z: number): Grid =>
  logicSetCellType(grid, x, z, "boulder");

export const logicMarkObstacles = (
  grid: Grid,
  positions: Position2D[]
): Grid =>
  positions.reduce(
    (accumulator, { x, z }) => logicMarkObstacle(accumulator, x, z),
    grid
  );
