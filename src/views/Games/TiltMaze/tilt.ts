import type { CoordinateTuple } from '@webgamekit/animation'
import type { GravityVector, MazeHole, ScreenTilt } from './types'
import { DEGREES_TO_RADIANS } from './config'

/**
 * Flip both axes, for players whose device reports the opposite sense to the specification.
 * The spec is unambiguous — a positive left-to-right reading means the right edge is tipped
 * down — but firmware disagrees often enough that a board which rolls the wrong way needs a
 * switch rather than an argument.
 * @param tilt The lean to flip
 * @param inverted Whether to flip at all
 * @returns The lean, negated when inverted
 */
export const applyTiltInversion = (tilt: ScreenTilt, inverted: boolean): ScreenTilt =>
  inverted ? { tiltX: -tilt.tiltX, tiltZ: -tilt.tiltZ } : tilt

/**
 * Convert a screen-space tilt into the gravity vector of a board leaning by those angles.
 *
 * This is the whole "inner mapping" trick: the board and its colliders never move, gravity does,
 * which is indistinguishable to the player and costs one vector assignment instead of
 * re-orienting every wall body each frame.
 * @param tilt Screen-space tilt in degrees
 * @param strength Gravity magnitude
 * @returns Gravity vector for the Rapier world
 */
export const getTiltGravity = (tilt: ScreenTilt, strength: number): GravityVector => {
  const xRadians = tilt.tiltX * DEGREES_TO_RADIANS
  const zRadians = tilt.tiltZ * DEGREES_TO_RADIANS

  const direction = {
    x: Math.sin(xRadians),
    y: -Math.cos(xRadians) * Math.cos(zRadians),
    z: Math.sin(zRadians)
  }

  // Composing two rotations stretches the vector past unit length, which would make a
  // diagonal lean fall faster than a straight one. Gravity only ever changes direction.
  const length = Math.hypot(direction.x, direction.y, direction.z)
  if (length === 0) return { x: 0, y: -strength, z: 0 }
  const scale = strength / length

  return { x: direction.x * scale, y: direction.y * scale, z: direction.z * scale }
}

/**
 * Move a tilt a fraction of the way toward a target, damping sensor jitter.
 * @param current Tilt currently applied
 * @param target Tilt just reported
 * @param smoothing Fraction of the gap closed this frame, 0 to 1
 * @returns The blended tilt
 */
export const smoothTilt = (
  current: ScreenTilt,
  target: ScreenTilt,
  smoothing: number
): ScreenTilt => ({
  tiltX: current.tiltX + (target.tiltX - current.tiltX) * smoothing,
  tiltZ: current.tiltZ + (target.tiltZ - current.tiltZ) * smoothing
})

/**
 * Build a tilt from the directional actions currently held, so a desktop keyboard or a gamepad
 * stick drives the same board as a phone.
 * @param activeActions Action names currently held down
 * @param degrees Tilt applied by a fully held direction
 * @returns Screen-space tilt
 */
export const getKeyboardTilt = (activeActions: readonly string[], degrees: number): ScreenTilt => {
  const axis = (negative: string, positive: string): number =>
    (activeActions.includes(positive) ? degrees : 0) -
    (activeActions.includes(negative) ? degrees : 0)

  return {
    tiltX: axis('tilt-left', 'tilt-right'),
    tiltZ: axis('tilt-up', 'tilt-down')
  }
}

/**
 * Find the hole a fallen ball went through, by nearest centre on the board plane.
 * @param x Ball world X
 * @param z Ball world Z
 * @param holes Every hole cut into the board
 * @returns The closest hole, or undefined when there are none
 */
export const findNearestHole = (
  x: number,
  z: number,
  holes: readonly MazeHole[]
): MazeHole | undefined =>
  holes.reduce<MazeHole | undefined>((nearest, hole) => {
    if (!nearest) return hole
    const distanceToHole = Math.hypot(hole.position[0] - x, hole.position[2] - z)
    const distanceToNearest = Math.hypot(nearest.position[0] - x, nearest.position[2] - z)
    return distanceToHole < distanceToNearest ? hole : nearest
  }, undefined)

/**
 * Choose hole positions from the maze's open cell centres.
 *
 * The goal takes the cell furthest from the ball's start so the round always requires crossing
 * the board, and traps are spread by sampling the remaining candidates at an even stride rather
 * than at random, which keeps a run reproducible for tests and screenshots.
 * @param cellCenters Open cell centres in world space
 * @param startPosition Where the ball spawns
 * @param trapCount How many trap holes to cut
 * @param minimumSpacing Smallest gap allowed between two holes
 * @returns Holes with exactly one goal
 */
export const planMazeHoles = (
  cellCenters: readonly CoordinateTuple[],
  startPosition: CoordinateTuple,
  trapCount: number,
  minimumSpacing: number
): MazeHole[] => {
  const distanceFromStart = (cell: CoordinateTuple): number =>
    Math.hypot(cell[0] - startPosition[0], cell[2] - startPosition[2])

  const reachable = cellCenters
    .filter((cell) => distanceFromStart(cell) >= minimumSpacing)
    .sort((first, second) => distanceFromStart(first) - distanceFromStart(second))

  const goalCell = reachable[reachable.length - 1]
  if (!goalCell) return []

  const goal: MazeHole = { position: goalCell, isGoal: true }
  const trapCandidates = reachable.slice(0, -1)

  const isCrowded = (candidate: CoordinateTuple, chosen: readonly MazeHole[]): boolean =>
    [goal, ...chosen].some(
      ({ position }) =>
        Math.hypot(position[0] - candidate[0], position[2] - candidate[2]) < minimumSpacing
    )

  // Traps are drawn one per distance band rather than taken in order, because taking them in
  // order piles every trap at whichever end of the board the sort favours — obvious on a long
  // portrait board, where the first half of the run would have no hazards at all.
  const bandSize = Math.max(1, Math.ceil(trapCandidates.length / trapCount))
  const traps = Array.from({ length: trapCount }).reduce<MazeHole[]>((chosen, _unused, band) => {
    const pick = trapCandidates
      .slice(band * bandSize, (band + 1) * bandSize)
      .find((candidate) => !isCrowded(candidate, chosen))
    return pick ? [...chosen, { position: pick, isGoal: false }] : chosen
  }, [])

  return [goal, ...traps]
}
