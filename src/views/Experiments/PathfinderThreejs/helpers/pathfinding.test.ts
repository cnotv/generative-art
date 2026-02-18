import { describe, expect, it } from "vitest";
import { getBestRoute } from "./pathfinding";
import { createGrid, markObstacle, setCellType } from "./grid";
import type { Grid } from "./grid";

const makeGrid = (width = 5, height = 5): Grid =>
  createGrid({ width, height, cellSize: 1, centerOffset: [0, 0, 0] });

describe("getBestRoute", () => {
  describe("valid paths", () => {
    it.each([
      ["same cell returns single-cell path", { x: 0, z: 0 }, { x: 0, z: 0 }, 1],
      ["adjacent horizontal cell", { x: 0, z: 0 }, { x: 1, z: 0 }, 2],
      ["adjacent vertical cell", { x: 0, z: 0 }, { x: 0, z: 1 }, 2],
      ["diagonal route on 5x5 grid", { x: 0, z: 0 }, { x: 4, z: 4 }, 9],
    ])("%s", (_label, start, goal, expectedLength) => {
      const grid = makeGrid();
      const path = getBestRoute(grid, start, goal);
      expect(path).not.toBeNull();
      expect(path!.length).toBe(expectedLength);
    });

    it("starts at start and ends at goal", () => {
      const grid = makeGrid();
      const start = { x: 0, z: 0 };
      const goal = { x: 4, z: 4 };
      const path = getBestRoute(grid, start, goal)!;
      expect(path[0]).toEqual(start);
      expect(path[path.length - 1]).toEqual(goal);
    });

    it("every step is adjacent (no diagonal jumps)", () => {
      const grid = makeGrid(10, 10);
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 9, z: 9 })!;
      path.reduce((previous, current) => {
        const dx = Math.abs(current.x - previous.x);
        const dz = Math.abs(current.z - previous.z);
        expect(dx + dz).toBe(1);
        return current;
      });
    });
  });

  describe("paths around obstacles", () => {
    it("routes around a single obstacle", () => {
      let grid = makeGrid();
      grid = markObstacle(grid, 2, 2);
      const path = getBestRoute(grid, { x: 0, z: 2 }, { x: 4, z: 2 });
      expect(path).not.toBeNull();
      // Path must not pass through the obstacle
      const passesObstacle = path!.some((p) => p.x === 2 && p.z === 2);
      expect(passesObstacle).toBe(false);
    });

    it("routes around a vertical wall with a gap", () => {
      let grid = makeGrid(7, 7);
      // Build wall at x=3 from z=0 to z=4 (gap at z=5 and z=6)
      [0, 1, 2, 3, 4].forEach((z) => {
        grid = markObstacle(grid, 3, z);
      });
      const path = getBestRoute(grid, { x: 0, z: 3 }, { x: 6, z: 3 });
      expect(path).not.toBeNull();
      const passesWall = path!.some((p) => p.x === 3 && p.z <= 4);
      expect(passesWall).toBe(false);
    });
  });

  describe("unreachable paths", () => {
    it("returns null when goal is completely surrounded by obstacles", () => {
      let grid = makeGrid();
      grid = markObstacle(grid, 2, 1);
      grid = markObstacle(grid, 2, 3);
      grid = markObstacle(grid, 1, 2);
      grid = markObstacle(grid, 3, 2);
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 2, z: 2 });
      expect(path).toBeNull();
    });

    it("returns null when start is out of grid bounds", () => {
      const grid = makeGrid();
      const path = getBestRoute(grid, { x: -1, z: 0 }, { x: 4, z: 4 });
      expect(path).toBeNull();
    });

    it("returns null when goal is out of grid bounds", () => {
      const grid = makeGrid();
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 10, z: 10 });
      expect(path).toBeNull();
    });

    it("returns null when start cell is an obstacle", () => {
      let grid = makeGrid();
      grid = markObstacle(grid, 0, 0);
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 4, z: 4 });
      expect(path).toBeNull();
    });
  });

  describe("gravel terrain", () => {
    it("avoids gravel when a free path exists", () => {
      let grid = makeGrid(5, 3);
      // Row z=1 is all gravel — free path above and below
      [0, 1, 2, 3, 4].forEach((x) => { grid = setCellType(grid, x, 1, "gravel"); });
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 4, z: 0 });
      expect(path).not.toBeNull();
      const usesGravel = path!.some((p) => p.z === 1);
      expect(usesGravel).toBe(false);
    });

    it("uses gravel when it is the only route", () => {
      let grid = makeGrid(3, 3);
      // Block all of z=0 and z=2 rows except start and goal; only path through gravel in z=1
      grid = markObstacle(grid, 1, 0);
      grid = markObstacle(grid, 1, 2);
      grid = setCellType(grid, 1, 1, "gravel");
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 2, z: 0 });
      expect(path).not.toBeNull();
      const usesGravel = path!.some((p) => p.z === 1);
      expect(usesGravel).toBe(true);
    });
  });

  describe("wormhole teleportation", () => {
    it("uses wormhole shortcut when available", () => {
      let grid = makeGrid(7, 1);
      // Place entrance at x=1, exit at x=5 — wormhole skips the middle
      grid = setCellType(grid, 1, 0, "wormholeEntrance");
      grid = setCellType(grid, 5, 0, "wormholeExit");
      const path = getBestRoute(grid, { x: 0, z: 0 }, { x: 6, z: 0 });
      expect(path).not.toBeNull();
      // Path includes the entrance and the exit (non-adjacent jump)
      const hasEntrance = path!.some((p) => p.x === 1 && p.z === 0);
      const hasExit = path!.some((p) => p.x === 5 && p.z === 0);
      expect(hasEntrance).toBe(true);
      expect(hasExit).toBe(true);
    });

    it("reaches goal via wormhole when direct path is blocked", () => {
      let grid = makeGrid(5, 3);
      // Block center column entirely
      [0, 1, 2].forEach((z) => { grid = markObstacle(grid, 2, z); });
      // Place wormhole across the wall
      grid = setCellType(grid, 1, 1, "wormholeEntrance");
      grid = setCellType(grid, 3, 1, "wormholeExit");
      const path = getBestRoute(grid, { x: 0, z: 1 }, { x: 4, z: 1 });
      expect(path).not.toBeNull();
    });
  });
});
