import type { CellType, Grid, Position2D } from "./types";
import { logicIsCellWalkable } from "./grid";

type PathNode = {
  position: Position2D;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
};

const ORTHOGONAL_NEIGHBORS: Position2D[] = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];

const GRAVEL_COST = 2;

const isInBounds = (pos: Position2D, grid: Grid): boolean =>
  pos.x >= 0 && pos.x < grid.width && pos.z >= 0 && pos.z < grid.height;

const getCellType = (pos: Position2D, grid: Grid): CellType =>
  grid.cells[pos.z][pos.x].type;

const isWalkable = (pos: Position2D, grid: Grid): boolean =>
  isInBounds(pos, grid) && logicIsCellWalkable(grid.cells[pos.z][pos.x]);

const getMoveCost = (grid: Grid, toPos: Position2D): number =>
  getCellType(toPos, grid) === "gravel" ? GRAVEL_COST : 1;

const manhattanDistance = (a: Position2D, b: Position2D): number =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

const makeNode = (
  position: Position2D,
  g: number,
  goal: Position2D,
  parent: PathNode | null
): PathNode => {
  const h = manhattanDistance(position, goal);
  return { position, g, h, f: g + h, parent };
};

const positionKey = (pos: Position2D): string => `${pos.x},${pos.z}`;

const reconstructPath = (node: PathNode): Position2D[] =>
  node.parent === null
    ? [node.position]
    : [...reconstructPath(node.parent), node.position];

const getWormholeNeighbors = (
  current: PathNode,
  goal: Position2D,
  grid: Grid,
  closedSet: Set<string>
): PathNode[] => {
  if (!isInBounds(current.position, grid)) return [];
  if (getCellType(current.position, grid) !== "wormholeEntrance") return [];

  return grid.cells
    .flat()
    .filter((c) => c.type === "wormholeExit" && !closedSet.has(positionKey(c)))
    .map((c) => makeNode({ x: c.x, z: c.z }, current.g, goal, current));
};

const getNeighborNodes = (
  current: PathNode,
  goal: Position2D,
  grid: Grid,
  closedSet: Set<string>
): PathNode[] => {
  const orthogonal = ORTHOGONAL_NEIGHBORS
    .map((offset) => ({
      x: current.position.x + offset.x,
      z: current.position.z + offset.z,
    }))
    .filter(
      (pos) => isWalkable(pos, grid) && !closedSet.has(positionKey(pos))
    )
    .map((pos) =>
      makeNode(pos, current.g + getMoveCost(grid, pos), goal, current)
    );

  return [...orthogonal, ...getWormholeNeighbors(current, goal, grid, closedSet)];
};

const findBestOpenNode = (openList: PathNode[]): PathNode =>
  openList.reduce((best, node) =>
    node.f < best.f || (node.f === best.f && node.h < best.h) ? node : best
  );

const updateOpenList = (
  openList: PathNode[],
  neighbors: PathNode[]
): PathNode[] =>
  neighbors.reduce((list, neighbor) => {
    const key = positionKey(neighbor.position);
    const existing = list.find((n) => positionKey(n.position) === key);
    if (!existing) return [...list, neighbor];
    if (neighbor.g < existing.g) {
      return list.map((n) =>
        positionKey(n.position) === key ? neighbor : n
      );
    }
    return list;
  }, openList);

const astarStep = (
  openList: PathNode[],
  closedSet: Set<string>,
  goal: Position2D,
  grid: Grid
): { path: Position2D[] | null; openList: PathNode[]; closedSet: Set<string> } => {
  if (openList.length === 0) return { path: null, openList, closedSet };

  const current = findBestOpenNode(openList);
  const remaining = openList.filter(
    (n) => positionKey(n.position) !== positionKey(current.position)
  );

  if (current.position.x === goal.x && current.position.z === goal.z) {
    return { path: reconstructPath(current), openList: remaining, closedSet };
  }

  const newClosed = new Set([...closedSet, positionKey(current.position)]);
  const neighbors = getNeighborNodes(current, goal, grid, newClosed);
  const newOpen = updateOpenList(remaining, neighbors);

  return { path: null, openList: newOpen, closedSet: newClosed };
};

/**
 * A* pathfinding algorithm. Returns the shortest path from start to goal,
 * or null if no path exists. Supports gravel (double cost) and wormholes
 * (instant teleport from any entrance to any exit).
 */
export const logicGetBestRoute = (
  grid: Grid,
  start: Position2D,
  goal: Position2D
): Position2D[] | null => {
  if (!isWalkable(start, grid) || !isInBounds(goal, grid)) return null;

  const startNode = makeNode(start, 0, goal, null);
  let openList: PathNode[] = [startNode];
  let closedSet = new Set<string>();
  const maxIterations = grid.width * grid.height;

  return Array.from({ length: maxIterations }).reduce<Position2D[] | null>(
    (result) => {
      if (result !== null || openList.length === 0) return result;
      const step = astarStep(openList, closedSet, goal, grid);
      openList = step.openList;
      closedSet = step.closedSet;
      return step.path;
    },
    null
  );
};
