import type { CoordinateTuple } from '@webgamekit/threejs'
import { MARBLE_OPTIONS } from '@/views/Games/MarbleMadness/config'
import { MARBLE_FLOW_JITTER_FRACTION, MARBLE_RADIUS_FRACTION_RANGE } from './config'

/**
 * One marble's drop point: a small jitter around the flow's centre, so a continuous stream
 * doesn't stack every marble on the exact same spot.
 * @param center The flow's centre.
 * @param dropHeight How high above the centre to drop from.
 * @param rigDiagonal The rig's size, to scale the jitter.
 * @param random Returns a value in [0, 1).
 * @returns The drop position.
 */
export const buildMarbleDropPosition = (
  center: CoordinateTuple,
  dropHeight: number,
  rigDiagonal: number,
  random: () => number = Math.random
): CoordinateTuple => {
  const jitter = rigDiagonal * MARBLE_FLOW_JITTER_FRACTION
  const offset = (): number => (random() * 2 - 1) * jitter
  return [center[0] + offset(), center[1] + dropHeight, center[2] + offset()]
}

/**
 * Picks a marble radius in proportion to the rig's size.
 * @param rigDiagonal The rig's size.
 * @param random Returns a value in [0, 1).
 * @returns The radius.
 */
export const pickMarbleRadius = (
  rigDiagonal: number,
  random: () => number = Math.random
): number => {
  const [minimum, maximum] = MARBLE_RADIUS_FRACTION_RANGE
  return rigDiagonal * (minimum + random() * (maximum - minimum))
}

/**
 * Reuses the Marble Editor's own marble textures, so the rig physics experiment drops the
 * same marbles rather than inventing a second set of art for the same object.
 * @param random Returns a value in [0, 1).
 * @returns A texture URL, or undefined when there are none.
 */
export const pickMarbleTexture = (random: () => number = Math.random): string | undefined =>
  MARBLE_OPTIONS.length === 0
    ? undefined
    : MARBLE_OPTIONS[Math.floor(random() * MARBLE_OPTIONS.length)].url
