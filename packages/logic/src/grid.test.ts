import { describe, expect, it } from "vitest";
import {
  logicCreateGrid,
  logicGridToWorld,
  logicWorldToGrid,
  logicMarkObstacle,
  logicMarkObstacles,
  logicSetCellType,
  logicIsCellWalkable,
} from "./grid";
import type { GridConfig } from "./types";

const baseConfig: GridConfig = {
  width: 10,
  height: 10,
  cellSize: 2,
  centerOffset: [0, 0, 0],
};

describe("logicCreateGrid", () => {
  it("creates correct dimensions", () => {
    const grid = logicCreateGrid(baseConfig);
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(10);
    expect(grid.cells.length).toBe(10);
    expect(grid.cells[0].length).toBe(10);
  });

  it("all cells start as empty type", () => {
    const grid = logicCreateGrid(baseConfig);
    const allEmpty = grid.cells.flat().every((cell) => cell.type === "empty");
    expect(allEmpty).toBe(true);
  });

  it("cells have correct grid coordinates", () => {
    const grid = logicCreateGrid(baseConfig);
    expect(grid.cells[0][0]).toEqual({ x: 0, z: 0, type: "empty" });
    expect(grid.cells[3][5]).toEqual({ x: 5, z: 3, type: "empty" });
  });
});

describe("logicIsCellWalkable", () => {
  it.each([
    ["empty", true],
    ["gravel", true],
    ["wormholeEntrance", true],
    ["wormholeExit", true],
    ["boulder", false],
  ] as const)('returns %s for type "%s"', (type, expected) => {
    const cell = { x: 0, z: 0, type };
    expect(logicIsCellWalkable(cell)).toBe(expected);
  });
});

describe("logicSetCellType", () => {
  it("sets the type of the target cell", () => {
    const grid = logicCreateGrid(baseConfig);
    const updated = logicSetCellType(grid, 3, 4, "gravel");
    expect(updated.cells[4][3].type).toBe("gravel");
  });

  it("does not mutate original grid (immutable)", () => {
    const grid = logicCreateGrid(baseConfig);
    logicSetCellType(grid, 3, 4, "gravel");
    expect(grid.cells[4][3].type).toBe("empty");
  });

  it("leaves all other cells unaffected", () => {
    const grid = logicCreateGrid(baseConfig);
    const updated = logicSetCellType(grid, 2, 2, "wormholeEntrance");
    const otherCells = updated.cells
      .flat()
      .filter((cell) => !(cell.x === 2 && cell.z === 2));
    expect(otherCells.every((cell) => cell.type === "empty")).toBe(true);
  });

  it.each([
    ["boulder"],
    ["gravel"],
    ["wormholeEntrance"],
    ["wormholeExit"],
  ] as const)("can set type to %s", (type) => {
    const grid = logicCreateGrid(baseConfig);
    expect(logicSetCellType(grid, 0, 0, type).cells[0][0].type).toBe(type);
  });
});

describe("logicGridToWorld", () => {
  it.each([
    [0, 0, [-10, 0, -10] as [number, number, number]],
    [5, 5, [0, 0, 0] as [number, number, number]],
    [9, 9, [8, 0, 8] as [number, number, number]],
    [10, 10, [10, 0, 10] as [number, number, number]],
  ])("converts grid (%d, %d) to world %s", (gridX, gridZ, expected) => {
    const result = logicGridToWorld(gridX, gridZ, baseConfig);
    expect(result[0]).toBeCloseTo(expected[0]);
    expect(result[1]).toBeCloseTo(expected[1]);
    expect(result[2]).toBeCloseTo(expected[2]);
  });

  it("respects centerOffset", () => {
    const config: GridConfig = { ...baseConfig, centerOffset: [5, 1, 3] };
    const result = logicGridToWorld(5, 5, config);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(3);
  });
});

describe("logicWorldToGrid", () => {
  it.each([
    [[-10, 0, -10] as [number, number, number], { x: 0, z: 0 }],
    [[0, 0, 0] as [number, number, number], { x: 5, z: 5 }],
    [[8, 0, 8] as [number, number, number], { x: 9, z: 9 }],
  ])("converts world %s to grid %s", (worldPos, expected) => {
    expect(logicWorldToGrid(worldPos, baseConfig)).toEqual(expected);
  });

  it("round-trips with logicGridToWorld", () => {
    const original = { x: 3, z: 7 };
    const worldPos = logicGridToWorld(original.x, original.z, baseConfig);
    const backToGrid = logicWorldToGrid(worldPos, baseConfig);
    expect(backToGrid).toEqual(original);
  });
});

describe("logicMarkObstacle", () => {
  it("marks a cell as boulder type", () => {
    const grid = logicCreateGrid(baseConfig);
    const updated = logicMarkObstacle(grid, 3, 4);
    expect(updated.cells[4][3].type).toBe("boulder");
  });

  it("does not mutate original grid (immutable)", () => {
    const grid = logicCreateGrid(baseConfig);
    logicMarkObstacle(grid, 3, 4);
    expect(grid.cells[4][3].type).toBe("empty");
  });

  it("leaves all other cells unaffected", () => {
    const grid = logicCreateGrid(baseConfig);
    const updated = logicMarkObstacle(grid, 2, 2);
    const otherCells = updated.cells
      .flat()
      .filter((cell) => !(cell.x === 2 && cell.z === 2));
    expect(otherCells.every((cell) => cell.type === "empty")).toBe(true);
  });
});

describe("logicMarkObstacles", () => {
  it("marks multiple cells as boulder type", () => {
    const grid = logicCreateGrid(baseConfig);
    const positions = [
      { x: 1, z: 1 },
      { x: 2, z: 3 },
      { x: 5, z: 5 },
    ];
    const updated = logicMarkObstacles(grid, positions);
    positions.forEach(({ x, z }) => {
      expect(updated.cells[z][x].type).toBe("boulder");
    });
  });

  it("does not mutate original grid (immutable)", () => {
    const grid = logicCreateGrid(baseConfig);
    logicMarkObstacles(grid, [{ x: 1, z: 1 }]);
    expect(grid.cells[1][1].type).toBe("empty");
  });
});
