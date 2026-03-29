---
sidebar_position: 5
---

# Package: @webgamekit/logic

Grid-based pathfinding and navigation utilities using A* algorithm.

## Installation

```bash
pnpm add @webgamekit/logic
```

## Grid System

A grid represents a 2D navigation map. Cells can be walkable (`empty`) or impassable (`boulder`/obstacle).

### logicCreateGrid(config)

Create an empty grid.

```typescript
import { logicCreateGrid } from '@webgamekit/logic';
import type { GridConfig } from '@webgamekit/logic';

const config: GridConfig = {
  width: 19,
  height: 19,
  cellSize: 4,
  centerOffset: [2, 0, 2],
};

const grid = logicCreateGrid(config);
```

**GridConfig:**

```typescript
interface GridConfig {
  width: number;        // Number of cells horizontally
  height: number;       // Number of cells vertically
  cellSize: number;     // World-space size per cell
  centerOffset: [number, number, number];  // World origin offset
}
```

### logicMarkObstacle(grid, x, z)

Mark a cell as impassable. Returns a new grid (immutable).

```typescript
import { logicMarkObstacle } from '@webgamekit/logic';

const gridWithWall = logicMarkObstacle(grid, 3, 5);
```

### logicMarkObstacles(grid, positions)

Mark multiple cells as obstacles at once.

```typescript
import { logicMarkObstacles } from '@webgamekit/logic';

const gridWithWalls = logicMarkObstacles(grid, [
  { x: 2, z: 3 },
  { x: 4, z: 1 },
]);
```

### logicIsCellWalkable(cell)

Check if a grid cell is passable.

```typescript
import { logicIsCellWalkable } from '@webgamekit/logic';

const walkable = logicIsCellWalkable(grid.cells[z][x]);
```

### logicSetCellType(grid, x, z, type)

Set a cell's type directly. Returns a new grid.

```typescript
import { logicSetCellType } from '@webgamekit/logic';

const updated = logicSetCellType(grid, 3, 5, 'boulder');
// or: logicSetCellType(grid, 3, 5, 'empty')
```

## Coordinate Conversion

### logicGridToWorld(gridX, gridZ, config)

Convert grid coordinates to world-space position.

```typescript
import { logicGridToWorld } from '@webgamekit/logic';

const [worldX, worldY, worldZ] = logicGridToWorld(4, 6, gridConfig);
```

### logicWorldToGrid(worldPos, config)

Convert a world-space position to grid coordinates (using `Math.floor`).

```typescript
import { logicWorldToGrid } from '@webgamekit/logic';

const { x, z } = logicWorldToGrid([worldX, worldY, worldZ], gridConfig);
```

> **Note:** For agent navigation, prefer rounding to the nearest cell rather than flooring. `Math.floor` can map an agent between cells to the cell it just left, causing A* to route backward. Use `Math.round` based conversion when computing the agent's current grid position for pathfinding.

## Pathfinding

### logicGetBestRoute(grid, start, goal)

Find the shortest path between two grid cells using A*. Returns `null` if no path exists or if the start cell is an obstacle.

```typescript
import { logicGetBestRoute } from '@webgamekit/logic';

const path = logicGetBestRoute(grid, { x: 0, z: 0 }, { x: 8, z: 8 });
// Returns: Position2D[] | null
// path[0] = start cell, path[last] = goal cell
```

> **Important:** If the start or goal position maps to an obstacle cell, the function returns `null`. Always validate that start/goal are walkable before calling, or snap them to the nearest walkable neighbor.

## Path Following

### logicAdvanceAlongPath(state, speed, delta)

Advance a path-follow state along a computed path.

```typescript
import { logicAdvanceAlongPath } from '@webgamekit/logic';
import type { PathFollowState } from '@webgamekit/logic';

const state: PathFollowState = {
  path: routeResult,
  currentIndex: 0,
  position: { x: startX, z: startZ },
};

const result = logicAdvanceAlongPath(state, speed, delta);
// result.position: updated world position
// result.state: updated PathFollowState for next frame
```

## Types

```typescript
import type {
  Grid,
  GridConfig,
  GridCell,
  CellType,
  Position2D,
  NumberTriple,
  PathFollowState,
  PathFollowResult,
  Waypoint,
} from '@webgamekit/logic';

type CellType = 'empty' | 'boulder';
type NumberTriple = [number, number, number];

interface Position2D {
  x: number;
  z: number;
}

interface GridCell {
  x: number;
  z: number;
  type: CellType;
}

interface Grid {
  cells: GridCell[][];
  width: number;
  height: number;
}
```

## Example: Maze Navigation

Building a navigation grid from a procedural maze and running A* pathfinding:

```typescript
import {
  logicCreateGrid,
  logicMarkObstacle,
  logicIsCellWalkable,
  logicGetBestRoute,
  logicGridToWorld,
} from '@webgamekit/logic';

const NAV_CONFIG = { width: 19, height: 19, cellSize: 4, centerOffset: [2, 0, 2] };

// Build nav grid from maze wall data
const buildNavGrid = (mazeGrid) => {
  const base = logicCreateGrid(NAV_CONFIG);

  // Mark all wall-corner intersections (odd x, odd z) as impassable
  const withCorners = mazeGrid.flat()
    .filter(({ gx, gz }) => gx % 2 === 1 && gz % 2 === 1)
    .reduce((g, { gx, gz }) => logicMarkObstacle(g, gx, gz), base);

  // Mark east/south walls from maze cell data
  return mazeGrid.flat().reduce((grid, cell) => {
    const gx = cell.col * 2;
    const gz = cell.row * 2;
    const withEast = cell.walls.east ? logicMarkObstacle(grid, gx + 1, gz) : grid;
    return cell.walls.south ? logicMarkObstacle(withEast, gx, gz + 1) : withEast;
  }, withCorners);
};

// Snap world position to nearest walkable cell
const toNearestWalkable = (worldX, worldZ, navGrid) => {
  const gx = Math.max(0, Math.min(NAV_CONFIG.width - 1,
    Math.round((worldX - NAV_CONFIG.centerOffset[0]) / NAV_CONFIG.cellSize + NAV_CONFIG.width / 2)
  ));
  const gz = Math.max(0, Math.min(NAV_CONFIG.height - 1,
    Math.round((worldZ - NAV_CONFIG.centerOffset[2]) / NAV_CONFIG.cellSize + NAV_CONFIG.height / 2)
  ));
  const pos = { x: gx, z: gz };
  if (logicIsCellWalkable(navGrid.cells[gz][gx])) return pos;
  // Check neighbors for walkable cell
  return [
    { x: gx - 1, z: gz }, { x: gx + 1, z: gz },
    { x: gx, z: gz - 1 }, { x: gx, z: gz + 1 },
  ].find((c) =>
    c.x >= 0 && c.x < navGrid.width &&
    c.z >= 0 && c.z < navGrid.height &&
    logicIsCellWalkable(navGrid.cells[c.z][c.x])
  ) ?? pos;
};

// Per-frame chase update
const updateChase = (agentPos, targetPos, navGrid, path) => {
  const start = toNearestWalkable(agentPos.x, agentPos.z, navGrid);
  const goal = toNearestWalkable(targetPos.x, targetPos.z, navGrid);
  return logicGetBestRoute(navGrid, start, goal);
};
```
