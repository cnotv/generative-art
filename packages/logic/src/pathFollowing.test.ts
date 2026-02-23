import { describe, expect, it } from "vitest";
import { logicAdvanceAlongPath } from "./pathFollowing";
import type { PathFollowState, Waypoint } from "./types";

const makeWaypoint = (x: number, y: number, z: number): Waypoint => ({ x, y, z });

const makeState = (waypoints: Waypoint[], currentIndex = 0, progress = 0): PathFollowState => ({
  waypoints,
  currentIndex,
  progress,
});

/** Two waypoints along the X axis, 10 units apart. */
const linearPath = [makeWaypoint(0, 0, 0), makeWaypoint(10, 0, 0)];

describe("logicAdvanceAlongPath", () => {
  describe("movement along a single segment", () => {
    it.each([
      ["zero delta produces no movement", 5, 0, 0, 0, 0],
      ["zero speed produces no movement", 0, 1, 0, 0, 0],
      ["advances halfway through segment", 5, 1, 5, 0, 0],
      ["advances one quarter through segment", 5, 0.5, 2.5, 0, 0],
    ])("%s", (_label, speed, delta, expectedX, expectedY, expectedZ) => {
      const state = makeState(linearPath);
      const result = logicAdvanceAlongPath(state, speed, delta);
      expect(result.position.x).toBeCloseTo(expectedX);
      expect(result.position.y).toBeCloseTo(expectedY);
      expect(result.position.z).toBeCloseTo(expectedZ);
    });

    it("reaches the end of a single segment exactly", () => {
      const state = makeState(linearPath);
      const result = logicAdvanceAlongPath(state, 10, 1);
      expect(result.position.x).toBeCloseTo(10);
      expect(result.isComplete).toBe(true);
    });

    it("clamps to final waypoint when overshoot occurs", () => {
      const state = makeState(linearPath);
      const result = logicAdvanceAlongPath(state, 100, 1);
      expect(result.position.x).toBeCloseTo(10);
      expect(result.isComplete).toBe(true);
    });

    it("is not complete when before the last waypoint", () => {
      const state = makeState(linearPath);
      const result = logicAdvanceAlongPath(state, 5, 1);
      expect(result.isComplete).toBe(false);
    });
  });

  describe("multi-segment paths", () => {
    const multiPath = [
      makeWaypoint(0, 0, 0),
      makeWaypoint(5, 0, 0),
      makeWaypoint(5, 0, 5),
    ];

    it("crosses segment boundary when advance distance exceeds segment length", () => {
      // Each segment is 5 units. Speed=6, delta=1 → cross first segment, 1 unit into second.
      const state = makeState(multiPath);
      const result = logicAdvanceAlongPath(state, 6, 1);
      expect(result.position.x).toBeCloseTo(5);
      expect(result.position.z).toBeCloseTo(1);
      expect(result.isComplete).toBe(false);
    });

    it("reaches final waypoint when advance covers entire path", () => {
      const state = makeState(multiPath);
      const result = logicAdvanceAlongPath(state, 10, 1.1);
      expect(result.position.x).toBeCloseTo(5);
      expect(result.position.z).toBeCloseTo(5);
      expect(result.isComplete).toBe(true);
    });

    it("completes remaining distance from mid-segment position", () => {
      // Start mid-way through first segment (progress=0.5 → at x=2.5)
      const state = makeState(multiPath, 0, 0.5);
      // Remaining in first segment = 2.5 units. Speed=3, delta=1 → 3 units travel → 0.5 into second segment.
      const result = logicAdvanceAlongPath(state, 3, 1);
      expect(result.position.x).toBeCloseTo(5);
      expect(result.position.z).toBeCloseTo(0.5);
    });
  });

  describe("3D movement (all axes)", () => {
    it("interpolates Y axis between waypoints at different heights", () => {
      const path = [makeWaypoint(0, 0, 0), makeWaypoint(0, 10, 0)];
      const state = makeState(path);
      const result = logicAdvanceAlongPath(state, 5, 1);
      expect(result.position.y).toBeCloseTo(5);
      expect(result.position.x).toBeCloseTo(0);
      expect(result.position.z).toBeCloseTo(0);
    });

    it("interpolates all axes simultaneously", () => {
      const path = [makeWaypoint(0, 0, 0), makeWaypoint(10, 10, 10)];
      const state = makeState(path);
      // Segment length = sqrt(300) ≈ 17.32. Speed = sqrt(300)/2, delta = 1 → travel half segment.
      const segmentLength = Math.sqrt(300);
      const result = logicAdvanceAlongPath(state, segmentLength / 2, 1);
      expect(result.position.x).toBeCloseTo(5);
      expect(result.position.y).toBeCloseTo(5);
      expect(result.position.z).toBeCloseTo(5);
    });
  });

  describe("rotation", () => {
    it.each([
      // THREE.js Y-rotation convention: 0 = facing -Z (default mesh orientation).
      // Formula: atan2(dx, -dz) → +X = π/2 ≈ 1.5, -X = -π/2, +Z = π ≈ 3, -Z = 0.
      ["facing positive X", [makeWaypoint(0, 0, 0), makeWaypoint(10, 0, 0)], Math.PI / 2],
      ["facing negative X", [makeWaypoint(10, 0, 0), makeWaypoint(0, 0, 0)], -Math.PI / 2],
      ["facing positive Z", [makeWaypoint(0, 0, 0), makeWaypoint(0, 0, 10)], Math.PI],
      ["facing negative Z", [makeWaypoint(0, 0, 10), makeWaypoint(0, 0, 0)], 0],
    ] as const)("%s", (_label, waypoints, expectedRotation) => {
      const state = makeState(waypoints as Waypoint[]);
      const result = logicAdvanceAlongPath(state, 1, 0.1);
      expect(result.rotation).toBeCloseTo(expectedRotation);
    });

    it.each([
      // Path: (0,0,0) → (10,0,0) → (10,0,10).
      // Segment 1 faces +X → π/2 ≈ 1.5. Segment 2 faces +Z → π ≈ 3.
      ["on first segment facing +X", 1, 1, Math.PI / 2],
      ["on second segment facing +Z", 11, 1, Math.PI],
      ["at goal retains final segment direction", 25, 1, Math.PI],
    ] as const)("3-node path: %s", (_label, speed, delta, expectedRotation) => {
      const waypoints = [makeWaypoint(0, 0, 0), makeWaypoint(10, 0, 0), makeWaypoint(10, 0, 10)];
      const state = makeState(waypoints);
      const result = logicAdvanceAlongPath(state, speed, delta);
      expect(result.rotation).toBeCloseTo(expectedRotation);
    });
  });

  describe("immutability", () => {
    it("does not mutate the input state", () => {
      const state = makeState(linearPath, 0, 0);
      const originalProgress = state.progress;
      const originalIndex = state.currentIndex;
      logicAdvanceAlongPath(state, 5, 1);
      expect(state.progress).toBe(originalProgress);
      expect(state.currentIndex).toBe(originalIndex);
    });

    it("does not mutate the input waypoints array", () => {
      const path = [makeWaypoint(0, 0, 0), makeWaypoint(10, 0, 0)];
      const state = makeState(path);
      logicAdvanceAlongPath(state, 5, 1);
      expect(path.length).toBe(2);
      expect(path[0]).toEqual({ x: 0, y: 0, z: 0 });
    });
  });
});
