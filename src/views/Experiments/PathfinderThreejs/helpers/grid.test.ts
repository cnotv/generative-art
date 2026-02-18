import { describe, expect, it } from "vitest";
import {
  createGrid,
  gridToWorld,
  worldToGrid,
  markObstacle,
  markObstacles,
  setCellType,
  isCellWalkable,
} from "./grid";
import type { GridConfig } from "./grid";

const baseConfig: GridConfig = {
  width: 10,
  height: 10,
  cellSize: 2,
  centerOffset: [0, 0, 0],
};

describe("createGrid", () => {
  it("creates correct dimensions", () => {
    const grid = createGrid(baseConfig);
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(10);
    expect(grid.cells.length).toBe(10);
    expect(grid.cells[0].length).toBe(10);
  });

  it("all cells start as empty type", () => {
    const grid = createGrid(baseConfig);
    const allEmpty = grid.cells.flat().every((cell) => cell.type === "empty");
    expect(allEmpty).toBe(true);
  });

  it("cells have correct grid coordinates", () => {
    const grid = createGrid(baseConfig);
    expect(grid.cells[0][0]).toEqual({ x: 0, z: 0, type: "empty" });
    expect(grid.cells[3][5]).toEqual({ x: 5, z: 3, type: "empty" });
  });
});

describe("isCellWalkable", () => {
  it.each([
    ["empty", true],
    ["gravel", true],
    ["wormholeEntrance", true],
    ["wormholeExit", true],
    ["boulder", false],
  ] as const)('returns %s for type "%s"', (type, expected) => {
    const cell = { x: 0, z: 0, type };
    expect(isCellWalkable(cell)).toBe(expected);
  });
});

describe("setCellType", () => {
  it("sets the type of the target cell", () => {
    const grid = createGrid(baseConfig);
    const updated = setCellType(grid, 3, 4, "gravel");
    expect(updated.cells[4][3].type).toBe("gravel");
  });

  it("does not mutate original grid (immutable)", () => {
    const grid = createGrid(baseConfig);
    setCellType(grid, 3, 4, "gravel");
    expect(grid.cells[4][3].type).toBe("empty");
  });

  it("leaves all other cells unaffected", () => {
    const grid = createGrid(baseConfig);
    const updated = setCellType(grid, 2, 2, "wormholeEntrance");
    const otherCells = updated.cells
      .flat()
      .filter((cell) => !(cell.x === 2 && cell.z === 2));
    expect(otherCells.every((cell) => cell.type === "empty")).toBe(true);
  });

  it("can set each CellType", () => {
    const grid = createGrid(baseConfig);
    expect(setCellType(grid, 0, 0, "boulder").cells[0][0].type).toBe("boulder");
    expect(setCellType(grid, 0, 0, "gravel").cells[0][0].type).toBe("gravel");
    expect(setCellType(grid, 0, 0, "wormholeEntrance").cells[0][0].type).toBe("wormholeEntrance");
    expect(setCellType(grid, 0, 0, "wormholeExit").cells[0][0].type).toBe("wormholeExit");
  });
});

describe("gridToWorld", () => {
  it.each([
    [0, 0, [-10, 0, -10] as [number, number, number]],
    [5, 5, [0, 0, 0] as [number, number, number]],
    [9, 9, [8, 0, 8] as [number, number, number]],
    [10, 10, [10, 0, 10] as [number, number, number]],
  ])("converts grid (%d, %d) to world %s", (gridX, gridZ, expected) => {
    const result = gridToWorld(gridX, gridZ, baseConfig);
    expect(result[0]).toBeCloseTo(expected[0]);
    expect(result[1]).toBeCloseTo(expected[1]);
    expect(result[2]).toBeCloseTo(expected[2]);
  });

  it("respects centerOffset", () => {
    const config: GridConfig = { ...baseConfig, centerOffset: [5, 1, 3] };
    const result = gridToWorld(5, 5, config);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(3);
  });
});

describe("worldToGrid", () => {
  it.each([
    [[-10, 0, -10] as [number, number, number], { x: 0, z: 0 }],
    [[0, 0, 0] as [number, number, number], { x: 5, z: 5 }],
    [[8, 0, 8] as [number, number, number], { x: 9, z: 9 }],
  ])("converts world %s to grid %s", (worldPos, expected) => {
    expect(worldToGrid(worldPos, baseConfig)).toEqual(expected);
  });

  it("round-trips with gridToWorld", () => {
    const original = { x: 3, z: 7 };
    const worldPos = gridToWorld(original.x, original.z, baseConfig);
    const backToGrid = worldToGrid(worldPos, baseConfig);
    expect(backToGrid).toEqual(original);
  });
});

describe("markObstacle", () => {
  it("marks a cell as boulder type", () => {
    const grid = createGrid(baseConfig);
    const updated = markObstacle(grid, 3, 4);
    expect(updated.cells[4][3].type).toBe("boulder");
  });

  it("does not mutate original grid (immutable)", () => {
    const grid = createGrid(baseConfig);
    markObstacle(grid, 3, 4);
    expect(grid.cells[4][3].type).toBe("empty");
  });

  it("leaves all other cells unaffected", () => {
    const grid = createGrid(baseConfig);
    const updated = markObstacle(grid, 2, 2);
    const otherCells = updated.cells
      .flat()
      .filter((cell) => !(cell.x === 2 && cell.z === 2));
    expect(otherCells.every((cell) => cell.type === "empty")).toBe(true);
  });
});

describe("markObstacles", () => {
  it("marks multiple cells as boulder type", () => {
    const grid = createGrid(baseConfig);
    const positions = [
      { x: 1, z: 1 },
      { x: 2, z: 3 },
      { x: 5, z: 5 },
    ];
    const updated = markObstacles(grid, positions);
    positions.forEach(({ x, z }) => {
      expect(updated.cells[z][x].type).toBe("boulder");
    });
  });

  it("does not mutate original grid (immutable)", () => {
    const grid = createGrid(baseConfig);
    markObstacles(grid, [{ x: 1, z: 1 }]);
    expect(grid.cells[1][1].type).toBe("empty");
  });
});
