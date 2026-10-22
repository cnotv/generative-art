import type { TracePoint, TraceCell, TraceSpacing, SectorTrace } from './types'

/** Pixels apart below which two corners count as one. */
const SAME_SPOT = 0.5

const sameSpot = (first: TracePoint, second: TracePoint): boolean =>
  Math.abs(first.x - second.x) < SAME_SPOT && Math.abs(first.y - second.y) < SAME_SPOT

const towards = (from: TracePoint, to: TracePoint, distance: number): TracePoint => {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return {
    x: from.x + ((to.x - from.x) / length) * distance,
    y: from.y + ((to.y - from.y) / length) * distance
  }
}

/**
 * A path through the points with every corner rounded, like a trace on a circuit board.
 * @param points The corners, in order; repeated points are dropped.
 * @param radius The largest corner radius, shrunk where a segment is too short for it.
 * @returns An SVG path.
 */
export const roundedPath = (points: TracePoint[], radius: number): string => {
  const corners = points.filter(
    (point, index) => index === 0 || !sameSpot(point, points[index - 1])
  )
  const turns = corners.slice(1, -1).map((corner, index) => {
    const [previous, next] = [corners[index], corners[index + 2]]
    const fit = Math.min(
      radius,
      Math.hypot(corner.x - previous.x, corner.y - previous.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2
    )
    const [entry, exit] = [towards(corner, previous, fit), towards(corner, next, fit)]
    return `L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`
  })
  const [start, end] = [corners[0], corners[corners.length - 1]]
  return [`M ${start.x} ${start.y}`, ...turns, `L ${end.x} ${end.y}`].join(' ')
}

// Each column's traces share a lane down the gap on its left. The deeper a cell, the further
// out its trace runs, so a trace turning into a higher cell never crosses one still going down.
const laneOf = (cell: TraceCell, cells: TraceCell[], spacing: TraceSpacing): number => {
  const column = cells.filter(({ left }) => Math.abs(left - cell.left) < 1)
  const row = column.filter(({ top }) => top < cell.top).length
  return cell.left - spacing.laneGap + spacing.laneStep * ((column.length - 1) / 2 - row)
}

/**
 * Traces from one point under the city to the top of every sector's icon: down from the
 * city, across to the lane beside the sector's column, down that lane, along the top edge of
 * the sector's cell and into its icon. Traces heading furthest out turn off highest, so no two
 * traces cross.
 * @param origin Where every trace starts.
 * @param cells The sector cells, in page order.
 * @param spacing How the traces are spaced.
 * @returns One trace per cell, in the same order.
 */
export const buildSectorTraces = (
  origin: TracePoint,
  cells: TraceCell[],
  spacing: TraceSpacing
): SectorTrace[] => {
  const lanes = cells.map((cell) => laneOf(cell, cells, spacing))
  const reach = lanes.map((lane) => Math.abs(lane - origin.x))
  return cells.map((cell, index) => {
    const busY =
      spacing.busTop + reach.filter((other) => other > reach[index]).length * spacing.busStep
    const centre = cell.left + cell.width / 2
    const end = { x: centre, y: cell.iconTop }
    const path = roundedPath(
      [
        origin,
        { x: origin.x, y: busY },
        { x: lanes[index], y: busY },
        { x: lanes[index], y: cell.top - spacing.runAbove },
        { x: centre, y: cell.top - spacing.runAbove },
        end
      ],
      spacing.cornerRadius
    )
    return { path, end }
  })
}
