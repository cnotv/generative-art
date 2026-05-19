---
sidebar_position: 99
---

# Bubble Shooter: Hex Grid, Snap, Match, and Row Pressure

This documents the non-obvious problems encountered while building the Bust-a-Move / Puzzle Bobble style bubble shooter (PR #145).

## Hex grid: odd-row overflow

The grid is 9 columns wide. Odd rows are offset right by half a bubble diameter to create the classic honeycomb pattern. The first implementation placed 9 bubbles in every row — but the rightmost bubble in an offset row exceeds the wall boundary by half a radius, causing balls to clip through the wall.

The fix: odd rows hold one fewer column than even rows. A single helper encapsulates this rule, and every function that touches grid columns — creation, snapping, garbage insertion, row addition — delegates to it. Forgetting it in any one place reintroduces the overflow.

## Row drop parity: always add two rows

When the grid descends under time pressure, adding a single row flips the odd/even parity of every existing row. A bubble that was in an even row (straight alignment) becomes an odd row (offset by half a cell) — it visually jumps sideways. This looks like a glitch and corrupts all snapping calculations.

The invariant: **always add rows in multiples of 2**. Adding two rows preserves the parity of all existing cells and is the only valid call site for the row-addition utility.

## Camera aspect ratio: bypassing `getTools()`

The shared Three.js environment helper initialises the camera aspect ratio from the full window dimensions. When a sidebar is present, the actual canvas is several hundred pixels narrower than the window, making the aspect ratio too wide — the grid appears shifted to the right and partially off-screen.

The fix is to bypass the shared helper entirely and read the canvas element's own dimensions at init time. A `ResizeObserver` then watches the canvas and corrects the camera aspect whenever the sidebar is toggled.

## Bubble generation: two-slot color queue

The HUD shows two circles: the bubble loaded in the barrel (fires next) and a preview of the one after. The first implementation refilled both slots the moment the player fired — the preview changed mid-flight, making ahead planning impossible.

The correct model shifts the queue **on landing, not on shoot**:

```mermaid
sequenceDiagram
    participant Player
    participant Barrel
    participant Queue

    Player->>Barrel: Shoot
    Barrel-->>Player: In-flight bubble (currentColor)
    Note over Queue: nextColor unchanged during flight

    Barrel->>Queue: Ball lands
    Queue->>Barrel: currentColor ← nextColor
    Queue->>Queue: nextColor ← pick new color from grid
    Barrel-->>Player: Load new bubble
```

On shoot, the loaded mesh is hidden and the in-flight mesh takes its place. `currentColor` does not change until the ball lands and snaps.

## Stick logic: snapping to the nearest empty cell

When the in-flight bubble collides with a grid bubble or reaches the ceiling, it snaps to the nearest valid empty hex cell. The snap function iterates all grid cells, converts each to world coordinates, and picks the one with the shortest distance to the hit point. Cells beyond the column limit for their row are excluded.

```mermaid
flowchart TD
    A[Ball collides or hits ceiling] --> B[Find nearest empty cell]
    B --> C[Place bubble in grid]
    C --> D[Run match check]
    D --> E{Group ≥ 3?}
    E -- Yes --> F[Pop matched bubbles]
    E -- No --> G[Skip]
    F --> H[Run dangle check]
    G --> H
    H --> I{Cells unreachable from ceiling?}
    I -- Yes --> J[Drop dangling bubbles]
    I -- No --> K[Done]
    J --> K
```

## Explode logic: BFS match and dangle

Two breadth-first searches run on every landing, in sequence.

**Match (pop):** Starting from the placed cell, BFS collects all connected cells of the same color. If the group reaches the minimum size (3), every cell in the group is cleared and removed from the scene. Each popped bubble spawns a small burst of particles.

**Dangle (fall):** A second BFS starts from every filled cell in the top row (the ceiling). Any filled cell not reachable from the ceiling is dangling — it has no structural path upward. Dangling cells are cleared and removed. This handles the classic chain reaction where popping a cluster drops a hanging group below it.

```mermaid
flowchart LR
    subgraph Match BFS
        A[Start at placed cell] --> B[Collect same-color neighbors]
        B --> C{Size ≥ min?}
        C -- Yes --> D[Clear group + spawn particles]
        C -- No --> E[Leave in place]
    end

    subgraph Dangle BFS
        F[Start from ceiling row] --> G[Mark all reachable cells]
        G --> H[Remaining filled cells = dangling]
        H --> I[Clear dangling cells]
    end

    D --> F
    E --> F
```

## Advance logic: row pressure and game over

**Row pressure:** on a configurable interval (30 s slow / 20 s medium / 12 s fast), two new rows of randomly colored bubbles are prepended to the top. An accumulator tracks elapsed time per frame to avoid drift — no `setInterval`. After each addition, the grid checks whether any bubble has crossed the fire line.

**Game over trigger:**

```mermaid
flowchart TD
    A[Frame tick] --> B[Add delta to accumulator]
    B --> C{Accumulator ≥ interval?}
    C -- No --> A
    C -- Yes --> D[Subtract interval from accumulator]
    D --> E[Add 2 rows at top]
    E --> F[Rebuild all meshes]
    F --> G{Any bubble below fire line?}
    G -- No --> A
    G -- Yes --> H[Game over]
```

**Fire line position:** the fire line Y coordinate is derived from the grid dimensions — `top position minus (rows − 2) × row height`. An earlier version hardcoded it to a fixed value that sat below the grid's actual bottom, so the game-over check never triggered. The formula ensures the line is always just above the last playable row, regardless of grid size.

## Multiplayer: separate grids, garbage rows

Each player manages their own local grid. The opponent's grid is never transmitted — only their score is broadcast over the network.

```mermaid
sequenceDiagram
    participant A as Player A
    participant B as Player B

    A->>A: Clear a complete row
    A->>B: bs-garbage { count }
    B->>B: Prepend gray rows to grid

    B->>B: Bubbles reach fire line
    B->>A: bs-gameover {}
    A->>A: Declare self winner
```

Gray (garbage) bubbles participate in snap and dangle but not in match — they cannot form a color group and cannot be popped directly.
