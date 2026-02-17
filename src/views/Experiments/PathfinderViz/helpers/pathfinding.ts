import type { Grid } from "./grid";

type Position = { x: number; z: number };

type PathNode = {
  position: Position;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
};

const ORTHOGONAL_NEIGHBORS: Position[] = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];

const isInBounds = (pos: Position, grid: Grid): boolean =>
  pos.x >= 0 && pos.x < grid.width && pos.z >= 0 && pos.z < grid.height;

const isWalkable = (pos: Position, grid: Grid): boolean =>
  isInBounds(pos, grid) && grid.cells[pos.z][pos.x].walkable;

const manhattanDistance = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

const makeNode = (
  position: Position,
  g: number,
  goal: Position,
  parent: PathNode | null
): PathNode => {
  const h = manhattanDistance(position, goal);
  return { position, g, h, f: g + h, parent };
};

const positionKey = (pos: Position): string => `${pos.x},${pos.z}`;

const reconstructPath = (node: PathNode): Position[] =>
  node.parent === null
    ? [node.position]
    : [...reconstructPath(node.parent), node.position];

const getNeighborNodes = (
  current: PathNode,
  goal: Position,
  grid: Grid,
  closedSet: Set<string>
): PathNode[] =>
  ORTHOGONAL_NEIGHBORS.map((offset) => ({
    x: current.position.x + offset.x,
    z: current.position.z + offset.z,
  }))
    .filter(
      (pos) =>
        isWalkable(pos, grid) && !closedSet.has(positionKey(pos))
    )
    .map((pos) => makeNode(pos, current.g + 1, goal, current));

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
      return list.map((n) => (positionKey(n.position) === key ? neighbor : n));
    }
    return list;
  }, openList);

const astarStep = (
  openList: PathNode[],
  closedSet: Set<string>,
  goal: Position,
  grid: Grid
): { path: Position[] | null; openList: PathNode[]; closedSet: Set<string> } => {
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
 * or null if no path exists.
 */
export const getBestRoute = (
  grid: Grid,
  start: Position,
  goal: Position
): Position[] | null => {
  if (!isWalkable(start, grid) || !isInBounds(goal, grid)) return null;

  const startNode = makeNode(start, 0, goal, null);
  let openList: PathNode[] = [startNode];
  let closedSet = new Set<string>();
  const maxIterations = grid.width * grid.height;

  return Array.from({ length: maxIterations }).reduce<Position[] | null>(
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

export type { Position };
