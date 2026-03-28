---
sidebar_position: 11
---

# MazeGame: Procedural Maze with Enemy Pathfinding

The MazeGame combines procedural level generation, A* pathfinding for enemies, elevator transitions between levels, and a coin collection mechanic — all built on `@webgamekit/threejs` and `@webgamekit/logic`.

## Procedural Maze Generation

Mazes are generated using a recursive backtracking algorithm on an N×N cell grid. Each cell tracks which of its four walls (north, south, east, west) remain intact. The algorithm carves passages until all cells have been visited.

The grid size is derived from `ISLAND_SIZE / MAZE_CELL_SIZE` — with an 80-unit island and 16-unit cells, this gives a 5×5 cell maze.

## Navigation Grid (2× Resolution)

The raw maze grid is too coarse for smooth A* navigation. A 2×-resolution nav grid is built on top:

- Maze cells map to **even** nav-grid positions (0, 2, 4, …)
- Wall passages and corners occupy **odd** positions
- All `(odd, odd)` intersections are marked as obstacles (wall corners)
- East/south walls from the maze data mark the corresponding `(odd, even)` and `(even, odd)` passage cells as obstacles

For a 5×5 maze (5 cells per side), the nav grid is 9×9 with a cell size of 8 world units.

## Backward-Path Bug

A subtle issue with `Math.floor`-based world→grid conversion: when an agent is exactly between two cells, `Math.floor` maps it to the cell it just left (behind the agent). A* then routes backward from that cell.

The fix uses `Math.round` to always map to the **nearest** cell, which is typically the one ahead of the agent. This prevents the characteristic "back and forth" movement visible when enemies approached waypoints.

## Enemy Pathfinding

Each paper-plane enemy maintains a `PaperPlanePathState`:

```typescript
interface PaperPlanePathState {
  path: Position2D[] | null;
  currentIndex: number;
  timeSinceReplan: number;
  stuckTime: number;
}
```

On each replan, `path[0]` (the agent's current cell) is always skipped — it represents the cell the agent is leaving and would otherwise cause the agent to target a waypoint behind its current position.

Waypoint advancement uses a reach distance of ~62% of the nav cell size (5 units for 8-unit cells), large enough to advance even when physics deflection shifts the agent slightly off the ideal path.

## Rotation Lerp

Snap-rotating to face a new waypoint direction every frame caused visible stutter when enemies hugged walls. A turn-speed limit (`PAPER_PLANE_TURN_SPEED = 8 rad/s`) smooths the rotation:

```typescript
let angleDiff = targetAngle - plane.rotation.y;
while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
plane.rotation.y += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), PAPER_PLANE_TURN_SPEED * delta);
```

The `[-π, π]` normalization ensures the character always takes the shortest rotation arc.

## Elevator Transitions

Two elevators (start and exit) are positioned at opposite corners of the maze island. When the player reaches the exit elevator with all coins collected, the level increments and a new maze is generated.

The elevator model (`office_elevator_door.glb`) plays a door-open animation via Three.js `AnimationMixer`. Because the animation clip length is short, a `timeScale = 3` multiplier speeds it up, and `clampWhenFinished = true` holds the final frame.

An auto-close timer fires after `ELEVATOR_CLOSE_DELAY` seconds.

## Level Progression

Each level increase:

1. Removes all existing maze walls, desks, coins, and enemies from the scene
2. Generates a new random maze
3. Rebuilds walls, spawns new coins at maze-cell centers
4. Respawns the player at the start elevator
5. Rebuilds the nav grid for enemy pathfinding

The score poster (a canvas texture on a 3D plane) updates in real time as coins are collected.

## Debug Helpers

All physics colliders have optional `showHelper: true` flags — colored boxes rendered over the physics bodies. Helper colors:

- Player: `0x00ff88` (green)
- Paper planes: `0xff4444` (red)
- Desks: `0xff8800` (orange)
- Elevators: `0x0088ff` (blue)

Toggle collider visibility at runtime via the config panel ("Show Colliders").
