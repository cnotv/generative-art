import type { PathFollowResult, PathFollowState, Waypoint } from "./types";

const segmentLength = (from: Waypoint, to: Waypoint): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return Math.hypot(dx, dy, dz);
};

const lerpWaypoint = (from: Waypoint, to: Waypoint, t: number): Waypoint => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  z: from.z + (to.z - from.z) * t,
});

const calculateFacingRotation = (from: Waypoint, to: Waypoint): number =>
  Math.atan2(to.x - from.x, -(to.z - from.z));

type AdvanceAccumulator = {
  index: number;
  progress: number;
  remainingDistance: number;
};

/**
 * Advances along the path by distributing remainingDistance across segments.
 * Uses reduce to avoid loops, crossing segment boundaries as needed.
 */
const advanceState = (
  waypoints: Waypoint[],
  startIndex: number,
  startProgress: number,
  distanceToAdvance: number
): { index: number; progress: number; isComplete: boolean } => {
  const segmentCount = waypoints.length - 1;

  const result = Array.from({ length: segmentCount - startIndex }).reduce<AdvanceAccumulator>(
    (accumulator) => {
      if (accumulator.remainingDistance <= 0) return accumulator;

      const from = waypoints[accumulator.index];
      const to = waypoints[accumulator.index + 1];
      const length = segmentLength(from, to);

      if (length === 0) return { ...accumulator, index: accumulator.index + 1, progress: 0 };

      const distanceTravelledInSegment = accumulator.progress * length;
      const distanceRemainingInSegment = length - distanceTravelledInSegment;

      if (accumulator.remainingDistance <= distanceRemainingInSegment) {
        const newProgress = (distanceTravelledInSegment + accumulator.remainingDistance) / length;
        return { index: accumulator.index, progress: newProgress, remainingDistance: 0 };
      }

      return {
        index: accumulator.index + 1,
        progress: 0,
        remainingDistance: accumulator.remainingDistance - distanceRemainingInSegment,
      };
    },
    { index: startIndex, progress: startProgress, remainingDistance: distanceToAdvance }
  );

  const isComplete =
    result.index >= segmentCount ||
    (result.index === segmentCount - 1 && result.progress >= 1);
  return {
    index: Math.min(result.index, segmentCount - 1),
    progress: isComplete ? 1 : result.progress,
    isComplete,
  };
};

/**
 * Advances a follower along a polyline of 3D waypoints by `speed * delta` world units.
 * Pure function — returns new state and position; never mutates inputs.
 */
export const logicAdvanceAlongPath = (
  state: PathFollowState,
  speed: number,
  delta: number
): PathFollowResult => {
  const { waypoints, currentIndex, progress } = state;

  if (waypoints.length < 2) {
    return {
      position: waypoints[0] ?? { x: 0, y: 0, z: 0 },
      rotation: 0,
      state,
      isComplete: true,
    };
  }

  const distanceToAdvance = speed * delta;
  const { index, progress: newProgress, isComplete } = advanceState(
    waypoints,
    currentIndex,
    progress,
    distanceToAdvance
  );

  const from = waypoints[index];
  const to = waypoints[index + 1] ?? waypoints[index];
  const position = isComplete ? to : lerpWaypoint(from, to, newProgress);
  const rotation = calculateFacingRotation(from, to);

  return {
    position,
    rotation,
    state: { waypoints, currentIndex: index, progress: newProgress },
    isComplete,
  };
};
