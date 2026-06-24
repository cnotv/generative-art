import type { NumberTriple, PathStepType } from './types'

/** Below this horizontal distance two nodes count as the same spot (in-place jump). */
export const LOGIC_STEP_SAME_SPOT_DISTANCE = 0.5
/** Upward rise above which a step becomes a forward jump rather than a walk. */
export const LOGIC_STEP_JUMP_MIN_RISE = 5

/**
 * Classify the path segment running from node `a` to node `b` by its geometry:
 * a same-spot pair is an in-place jump, an upward rise is a forward jump, and
 * anything else (flat or descending) is a walk.
 * @param a - The segment's start node [x, y, z]
 * @param b - The segment's end node [x, y, z]
 * @returns The step type for the a→b segment
 */
export const logicClassifyPathSegment = (a: NumberTriple, b: NumberTriple): PathStepType => {
  const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2])
  if (horizontal < LOGIC_STEP_SAME_SPOT_DISTANCE) return 'jump'
  return b[1] - a[1] > LOGIC_STEP_JUMP_MIN_RISE ? 'forward-jump' : 'walk'
}
