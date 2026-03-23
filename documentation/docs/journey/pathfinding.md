---
sidebar_position: 4
---

# Pathfinding

A\* pathfinding on a uniform grid is straightforward in 2D but requires additional handling for 3D terrain.

**Grid construction**: the world is divided into a uniform grid of nodes. Each node stores walkability and, in 3D scenes, its Y height sampled from the terrain.

**A\* specifics**:

- Uses a min-heap (priority queue) on `f = g + h` where `h` is the Euclidean distance to the goal.
- Diagonal movement is allowed with a cost of `√2` vs `1` for cardinal directions.
- Obstacle nodes are excluded from the open set.

**3D height snapping**: pathfinding operates on the XZ plane; Y is determined by raycasting downward from the node's XZ position onto the terrain mesh. Without this, agents float or clip through hills.

**Path smoothing**: raw A\* paths hug the grid and look mechanical. A post-process pass (string-pulling / funnel algorithm) removes redundant waypoints where line-of-sight exists between non-adjacent nodes.

**Path following**: the agent moves toward the next waypoint each frame. When within a threshold distance, it advances to the next node. The threshold must be larger than the per-frame movement step, otherwise the agent can overshoot and oscillate.
