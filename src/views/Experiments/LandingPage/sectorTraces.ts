import type { TracePoint, SectorTrace } from './types'

/** How far the curves keep pointing straight down at each end, as a share of the drop. */
const ARROW_BEND = 0.55

/**
 * Curved arrows from one point under the city to the top of every sector's avatar. Each leaves
 * straight down and arrives straight down, so an arrow to a second row of avatars drops through
 * the gap above it rather than across the first row.
 * @param origin Where every arrow starts.
 * @param targets The top of each avatar, in page order.
 * @param gap How far short of its avatar each arrow stops.
 * @returns One arrow per avatar, in the same order.
 */
export const buildSectorTraces = (
  origin: TracePoint,
  targets: TracePoint[],
  gap: number
): SectorTrace[] =>
  targets.map((target) => {
    const end = { x: target.x, y: target.y - gap }
    const bend = (end.y - origin.y) * ARROW_BEND
    return {
      path: `M ${origin.x} ${origin.y} C ${origin.x} ${origin.y + bend} ${end.x} ${end.y - bend} ${end.x} ${end.y}`,
      end
    }
  })
