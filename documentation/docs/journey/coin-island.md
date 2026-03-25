---
sidebar_position: 11
---

# Coin Island

A top-down game prototype where a player collects coins in an office environment while being chased by paper airplane enemies navigating procedural mazes.

## Raycasting collision fails below obstacle geometry

`controllerForward` (from `@webgamekit/animation`) checks obstacles by firing a horizontal ray from the player's current position. The player model is positioned at `y = -1.15` (feet level), but desk GLTF models load with their geometry starting at `y ≈ 0`. The ray flies entirely below the desk and registers no hit — the player walks through.

**Fix**: replace raycasting with the Rapier character controller for all moving entities. `moveController` calls `characterController.computeColliderMovement`, which resolves against all fixed bodies in the physics world in 3D space regardless of height.

```ts
// Before — raycasting, height-sensitive
controllerForward(obstacles, groundBodies, animationData, playerMovement);

// After — Rapier CC, resolves against all fixed colliders
const { direction } = getMovementDirection(player, 1, false);
moveController(player, { x: direction.x * speed * delta, y: 0, z: direction.z * speed * delta });
```

## getModel creates ball physics; desks need cuboid colliders

`getModel` (GLTF loader) always creates a ball-shaped Rapier collider regardless of the `type` option. For desk models this produces a sphere centred at the desk position that does not match the desk footprint.

**Fix**: after loading the GLTF for visuals, call `getPhysic` explicitly with `shape: 'cuboid'` (the default) and the desired size. The new fixed cuboid is registered in the physics world alongside the old ball — the old one is harmless since it is fixed — and the character controller resolves against both.

```ts
getModel(scene, world, DESK_MODEL, { type: 'fixed', ... }).then((desk) => {
  getPhysic(world, { position: desk.position.toArray(), size: DESK_PHYSICS_SIZE, type: 'fixed' });
  return desk;
});
```

## Maze generation needs wall orientation for correct getCube sizing

`generateMazeWallPositions` returns only positions. To create properly shaped wall cubes with `getCube`, you need to know whether each wall runs along X (N/S wall) or Z (E/W wall), so one axis uses `cellSize` and the other uses `wallThickness`.

**Fix**: add `generateMazeWallSegments` that returns `{ position, horizontal }` pairs. `horizontal: true` means the wall runs along X (N/S boundary), so `size = [cellSize, height, thickness]`. `horizontal: false` means E/W, so `size = [thickness, height, cellSize]`.

```ts
segments.map(({ position: [wx, , wz], horizontal }) =>
  getCube(scene, world, {
    position: [deskX + wx, MAZE_WALL_HEIGHT / 2, deskZ + wz],
    size: horizontal
      ? [MAZE_CELL_SIZE, MAZE_WALL_HEIGHT, MAZE_WALL_THICKNESS]
      : [MAZE_WALL_THICKNESS, MAZE_WALL_HEIGHT, MAZE_CELL_SIZE],
  })
);
```

## Enemy A* navigation around maze walls

Wasps previously moved in a straight line toward the player and were blocked by raycasting. With procedural maze walls they needed real path planning.

**Approach**: build a global A* grid (20×20 cells at `cellSize = 4`) covering the island. After generating all desk mazes, convert each wall segment's world position to grid coordinates and mark those cells as boulders. Re-run `logicGetBestRoute` every 0.5 s per wasp; between replans the wasp follows the current path by advancing to the next waypoint when within `WASP_WAYPOINT_REACH_DISTANCE`.

```ts
export const buildNavigationGrid = (mazeData: DeskMazeData[]): Grid =>
  mazeData.reduce(
    (grid, { deskPos, segments }) =>
      segments.reduce((g, { position: [wx, , wz] }) => {
        const gridPos = logicWorldToGrid([deskPos[0] + wx, 0, deskPos[2] + wz], NAVIGATION_GRID_CONFIG);
        return logicMarkObstacle(g, gridPos.x, gridPos.z);
      }, grid),
    logicCreateGrid(NAVIGATION_GRID_CONFIG)
  );
```

The maze data must be shared between physical cube spawning and grid building — calling `generateMazeWallSegments` twice would produce different random mazes. `createMazesAroundDesks` generates segments once and returns `{ walls, mazeData }`.

## 3D score poster via CanvasTexture

Rather than a Vue overlay, the score is displayed on three in-world posters (back, left, right walls) using a shared `THREE.CanvasTexture`. A 512×512 canvas draws white background and Impact-font text. Updating `texture.needsUpdate = true` after redrawing propagates the change to all three poster meshes without creating new geometry.

```ts
const drawPoster = (ctx: CanvasRenderingContext2D, score: number): void => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, POSTER_CANVAS_SIZE, POSTER_CANVAS_SIZE);
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${POSTER_NUMBER_FONT_SIZE}px Impact, 'Arial Black', sans-serif`;
  ctx.fillText(String(score), POSTER_CANVAS_SIZE / 2, (POSTER_CANVAS_SIZE * 2) / 3);
};

// Shared across all three poster groups:
return (score: number) => { drawPoster(ctx, score); texture.needsUpdate = true; };
```
