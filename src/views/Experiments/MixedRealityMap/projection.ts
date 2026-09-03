import type { GeoPoint, PlacedLabel, Place, StreetLine, StreetPath } from './types'

const DEGREES_TO_RADIANS = Math.PI / 180
const RADIANS_TO_DEGREES = 180 / Math.PI
const EARTH_RADIUS_METERS = 6_371_008.8
const HALF_TURN_DEGREES = 180
const FULL_TURN_DEGREES = 360
const METERS_IN_A_KILOMETER = 1000

/**
 * Great-circle distance between two positions.
 * @param from Where the viewer is
 * @param to Where the place is
 * @returns Distance in metres
 */
export const getDistanceMeters = (from: GeoPoint, to: GeoPoint): number => {
  const fromLatitude = from.latitude * DEGREES_TO_RADIANS
  const toLatitude = to.latitude * DEGREES_TO_RADIANS
  const latitudeSpan = (to.latitude - from.latitude) * DEGREES_TO_RADIANS
  const longitudeSpan = (to.longitude - from.longitude) * DEGREES_TO_RADIANS

  const chord =
    Math.sin(latitudeSpan / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeSpan / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(chord)))
}

/**
 * Initial great-circle bearing from one position to another.
 * @param from Where the viewer is
 * @param to Where the place is
 * @returns Compass bearing in degrees, 0 at north and increasing clockwise
 */
export const getBearingDegrees = (from: GeoPoint, to: GeoPoint): number => {
  const fromLatitude = from.latitude * DEGREES_TO_RADIANS
  const toLatitude = to.latitude * DEGREES_TO_RADIANS
  const longitudeSpan = (to.longitude - from.longitude) * DEGREES_TO_RADIANS

  const east = Math.sin(longitudeSpan) * Math.cos(toLatitude)
  const north =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeSpan)

  return (
    (((Math.atan2(east, north) * RADIANS_TO_DEGREES) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) %
    FULL_TURN_DEGREES
  )
}

/**
 * The shorter way round from one bearing to another, so a heading of 350 and a bearing of 10
 * read as twenty degrees apart rather than three hundred and forty.
 * @param bearingDegrees Where the place is
 * @param headingDegrees Where the camera points
 * @returns Signed difference in degrees, positive when the place is to the right
 */
export const getBearingOffset = (bearingDegrees: number, headingDegrees: number): number =>
  ((bearingDegrees - headingDegrees + HALF_TURN_DEGREES * 3) % FULL_TURN_DEGREES) -
  HALF_TURN_DEGREES

const FRAME_CENTER_PERCENT = 50
const FRAME_HALF_PERCENT = 50
const MAX_OFFSET_PERCENT = 1000

// A bearing near the side of the camera, still in front but only barely, has a cosine close to
// zero: the divide that turns it into a screen position explodes toward infinity right where
// isInFront is still true. A card never reaches this, because it is dropped by isInView first,
// but a street line is drawn a little past the frame edge on purpose, and without a bound its
// far end lands thousands of percent off the frame and drags a stray edge across the visible
// part of the line on the way there.
const clampOffsetPercent = (value: number): number =>
  Math.max(-MAX_OFFSET_PERCENT, Math.min(MAX_OFFSET_PERCENT, value))

/**
 * Where a bearing lands across the frame's width.
 *
 * Height plays no part: with the camera's own tilt taken out of the picture, a compass bearing
 * is the whole of what decides where something sits, and it sits on whatever fixed row its kind
 * of thing is drawn on. A lens still draws the world in perspective across that one axis, so the
 * mapping from angle to pixel is a tangent and not a proportion: a bearing half a field of view
 * off centre belongs at the frame edge, and one a quarter of the way off belongs nearer the
 * middle than a straight division would put it.
 * @param bearingDegrees Compass bearing of the thing
 * @param headingDegrees Where the camera points
 * @param horizontalDegrees How much of the compass the frame's width takes in
 * @returns Position as a percent of the frame's width, and whether it falls inside it at all
 */
export const getHorizontalPlacement = (
  bearingDegrees: number,
  headingDegrees: number,
  horizontalDegrees: number
): { xPercent: number; isInView: boolean; isInFront: boolean } => {
  const offset = getBearingOffset(bearingDegrees, headingDegrees) * DEGREES_TO_RADIANS
  const halfWidth = Math.tan((horizontalDegrees / 2) * DEGREES_TO_RADIANS)
  const horizontal = Math.tan(offset)
  const isInFront = Math.cos(offset) > 0

  return {
    xPercent:
      FRAME_CENTER_PERCENT + clampOffsetPercent((horizontal / halfWidth) * FRAME_HALF_PERCENT),
    isInFront,
    isInView: isInFront && Math.abs(horizontal) <= halfWidth
  }
}

/**
 * Move a bearing a fraction of the way toward another, the short way round.
 *
 * A magnetometer is noisy enough that labels visibly shiver when placed straight off it, and
 * averaging the raw number would swing a full turn every time the reading crossed north.
 * @param current The bearing in use
 * @param target The bearing just reported
 * @param smoothing Fraction of the gap closed, 0 to 1
 * @returns The blended bearing, inside a single turn
 */
export const smoothBearing = (current: number, target: number, smoothing: number): number =>
  (current + getBearingOffset(target, current) * smoothing + FULL_TURN_DEGREES) % FULL_TURN_DEGREES

const METERS_PER_DEGREE_LATITUDE = 111_320

/**
 * Step a position a given distance along a bearing.
 *
 * Flat-earth arithmetic, which is exact enough over the tens of metres a road is wide and much
 * cheaper than the spherical form.
 * @param from Where to start
 * @param bearingDegrees Which way to step, 0 at north
 * @param meters How far to step
 * @returns The stepped position
 */
export const offsetGeoPoint = (
  from: GeoPoint,
  bearingDegrees: number,
  meters: number
): GeoPoint => {
  const bearing = bearingDegrees * DEGREES_TO_RADIANS
  const northward = (meters * Math.cos(bearing)) / METERS_PER_DEGREE_LATITUDE
  const eastward =
    (meters * Math.sin(bearing)) /
    (METERS_PER_DEGREE_LATITUDE * Math.cos(from.latitude * DEGREES_TO_RADIANS))

  return { latitude: from.latitude + northward, longitude: from.longitude + eastward }
}

/**
 * A position in flat metres north and east of an origin, cheap enough to call once per point of
 * every street on every position update.
 * @param origin Where the distances are measured from
 * @param point The position to convert
 * @returns Metres north and east of the origin
 */
const toLocalMeters = (origin: GeoPoint, point: GeoPoint): { east: number; north: number } => {
  const distanceMeters = getDistanceMeters(origin, point)
  const bearing = getBearingDegrees(origin, point) * DEGREES_TO_RADIANS

  return { east: distanceMeters * Math.sin(bearing), north: distanceMeters * Math.cos(bearing) }
}

/**
 * How far the origin sits from the nearest point of a single stretch of road, not just its ends.
 * @param origin Where the viewer is
 * @param start One end of the stretch
 * @param end The other end
 * @returns The perpendicular distance in metres, falling back to the nearer end past it
 */
const getDistanceToSegmentMeters = (origin: GeoPoint, start: GeoPoint, end: GeoPoint): number => {
  const from = toLocalMeters(origin, start)
  const to = toLocalMeters(origin, end)
  const runEast = to.east - from.east
  const runNorth = to.north - from.north
  const lengthSquared = runEast ** 2 + runNorth ** 2

  const alongRun =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(from.east * runEast + from.north * runNorth) / lengthSquared))

  return Math.hypot(from.east + alongRun * runEast, from.north + alongRun * runNorth)
}

/**
 * How close a street actually comes to where the viewer stands, along its nearest stretch
 * rather than its nearest node.
 *
 * A long straight stretch can pass right by the viewer between two nodes that are both some
 * way off, so every segment is checked rather than every point.
 * @param path The street to measure
 * @param origin Where the viewer is
 * @returns The perpendicular distance to the nearest stretch, in metres
 */
const getPathDistanceMeters = (path: StreetPath, origin: GeoPoint): number =>
  path.points
    .slice(1)
    .reduce(
      (closest, point, index) =>
        Math.min(closest, getDistanceToSegmentMeters(origin, path.points[index], point)),
      Infinity
    )

/**
 * Whether a street actually crosses close to where the viewer stands, rather than merely
 * passing somewhere within the wider fetch radius.
 *
 * A radius alone keeps every named road for blocks around, which draws far more than the one
 * or two streets meeting at a corner.
 * @param path The street to test
 * @param origin Where the viewer is
 * @param thresholdMeters How close counts as crossing
 * @returns True where some stretch of the path comes within the threshold
 */
export const isAdjacentStreetPath = (
  path: StreetPath,
  origin: GeoPoint,
  thresholdMeters: number
): boolean => getPathDistanceMeters(path, origin) <= thresholdMeters

/**
 * Which streets to draw: everything actually crossing where the viewer stands, padded out with
 * whatever is nearest until there is something to draw at all.
 *
 * A corner with nothing crossing it directly, or a single street running past, would otherwise
 * draw one line or none, which reads as broken rather than as a quiet block. Padding out to a
 * minimum keeps the overlay looking populated everywhere without drawing streets that are
 * nowhere near the one actually underfoot when there is no shortage of those.
 * @param paths Every street found within the wider fetch radius
 * @param origin Where the viewer is
 * @param thresholdMeters How close counts as crossing
 * @param minimumCount The fewest streets to draw, when that many exist at all
 * @returns The streets to draw, nearest first
 */
export const selectNearbyStreetPaths = (
  paths: readonly StreetPath[],
  origin: GeoPoint,
  thresholdMeters: number,
  minimumCount: number
): StreetPath[] => {
  const nearestFirst = [...paths].sort(
    (first, second) => getPathDistanceMeters(first, origin) - getPathDistanceMeters(second, origin)
  )
  const adjacentCount = nearestFirst.filter(
    (path) => getPathDistanceMeters(path, origin) <= thresholdMeters
  ).length

  return nearestFirst.slice(0, Math.max(adjacentCount, Math.min(minimumCount, nearestFirst.length)))
}

/**
 * Project streets as a continuous line at a fixed height, sweeping only with the compass.
 *
 * A road that narrows into the distance still reads as fussy laid over a moving camera image; a
 * street held to one steady row and swept purely by bearing reads as a stable anchor for its
 * name instead, and cannot itself bob with every small tilt of the phone.
 * @param paths The street centre lines
 * @param origin Where the viewer is
 * @param headingDegrees Where the camera points
 * @param horizontalDegrees How much of the compass the frame's width takes in
 * @param rowPercent The fixed row every street is drawn on
 * @returns Each run of a street that stays in front of the camera, with somewhere to write its name
 */
export const projectStreetLines = (
  paths: readonly StreetPath[],
  origin: GeoPoint,
  headingDegrees: number,
  horizontalDegrees: number,
  rowPercent: number
): StreetLine[] =>
  paths.flatMap((path) => {
    const projected = path.points.map((point) =>
      getHorizontalPlacement(getBearingDegrees(origin, point), headingDegrees, horizontalDegrees)
    )

    // Cut wherever the street passes the camera, or the part behind would fold back into frame.
    const runs = projected.reduce<(typeof projected)[]>(
      (collected, step) =>
        step.isInFront
          ? [...collected.slice(0, -1), [...collected[collected.length - 1], step]]
          : [...collected, []],
      [[]]
    )

    return runs
      .filter((run) => run.length >= 2)
      .map((run, index) => ({
        id: `${path.id}/${index}`,
        name: path.name,
        points: run.map(({ xPercent }) => ({ xPercent, yPercent: rowPercent })),
        namePoint: { xPercent: run[Math.floor(run.length / 2)].xPercent, yPercent: rowPercent }
      }))
  })

/**
 * Push cards off each other where they would land in the same place, rather than letting them
 * squeeze together or overlap.
 *
 * Every card starts on the same fixed row, so two sharing a column is the common case rather
 * than the rare one. Each is pushed up by the actual height of whatever is already stacked in
 * its column, a grouped card's several rows included, rather than by a single guessed step that
 * would work for one row and cut a taller card off from the next.
 * @param labels The labels, nearest first, since the nearest keeps the base row
 * @param columnWidthPercent How close two labels have to be to count as sharing a column
 * @returns The same labels, pushed clear of each other
 */
export const spreadLabels = (
  labels: readonly PlacedLabel[],
  columnWidthPercent: number
): PlacedLabel[] =>
  labels.reduce<PlacedLabel[]>((placed, label) => {
    const stackedHeight = placed
      .filter((other) => Math.abs(other.xPercent - label.xPercent) < columnWidthPercent)
      .reduce((total, other) => total + other.heightPercent, 0)

    // Held inside the frame. A landscape phone is short, and a tall stack pushed off one
    // horizon runs straight off the top edge, where an overlapping card would at least be read.
    const pushed = label.yPercent - stackedHeight

    return [...placed, { ...label, yPercent: Math.max(pushed, label.heightPercent) }]
  }, [])

/**
 * Place every visible thing on the frame.
 *
 * Only the nearest few survive, because a city centre has more names within reach than a phone
 * screen has room for, and they are returned furthest first so the nearest card draws on top.
 * @param clusters Everything found nearby, grouped with whatever else shares its address
 * @param origin Where the viewer is
 * @param headingDegrees Where the camera points
 * @param horizontalDegrees How much of the compass the frame's width takes in
 * @param limits How many cards fit, how tall a row is, how far apart cards sit, and the row
 *   every card starts on
 * @returns The cards to draw, furthest first
 */
/** The stable id for a cluster of one or more places sharing a card. */
const getClusterId = (cluster: readonly Place[]): string => cluster.map(({ id }) => id).join('+')

export const placeLabels = (
  clusters: readonly Place[][],
  origin: GeoPoint,
  headingDegrees: number,
  horizontalDegrees: number,
  limits: {
    maximumLabels: number
    rowHeightPercent: number
    columnWidthPercent: number
    baseRowPercent: number
  }
): PlacedLabel[] => {
  const nearestFirst = clusters
    .flatMap((tenants) => {
      const [nearest, ...rest] = [...tenants].sort(
        (first, second) => getDistanceMeters(origin, first) - getDistanceMeters(origin, second)
      )
      if (!nearest) return []

      const bearingDegrees = getBearingDegrees(origin, nearest)
      const distanceMeters = getDistanceMeters(origin, nearest)
      const placement = getHorizontalPlacement(bearingDegrees, headingDegrees, horizontalDegrees)
      if (!placement.isInView) return []

      return [
        {
          id: getClusterId(tenants),
          places: [nearest, ...rest],
          bearingDegrees,
          distanceMeters,
          xPercent: placement.xPercent,
          yPercent: limits.baseRowPercent,
          heightPercent: limits.rowHeightPercent * tenants.length
        }
      ]
    })
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, limits.maximumLabels)

  return spreadLabels(nearestFirst, limits.columnWidthPercent).sort(
    (first, second) => second.distanceMeters - first.distanceMeters
  )
}

/**
 * How many venues sit off to each side of the frame right now, summarised to the two
 * directions turning the phone actually moves them toward.
 *
 * Anything not drawn as a card counts, whether it fell outside the field of view or was simply
 * past the cap on how many cards fit at once; a bearing still says which way to turn for it
 * either way.
 * @param clusters Everything found nearby, grouped the same way the cards are
 * @param shownIds The clusters currently drawn as cards, by id
 * @param origin Where the viewer is
 * @param headingDegrees Where the camera points
 * @returns How many venues are off to the left and to the right
 */
export const countOffScreenVenues = (
  clusters: readonly Place[][],
  shownIds: Set<string>,
  origin: GeoPoint,
  headingDegrees: number
): { left: number; right: number } =>
  clusters.reduce(
    (counts, cluster) => {
      const nearest = cluster[0]
      if (!nearest || shownIds.has(getClusterId(cluster))) return counts

      const offset = getBearingOffset(getBearingDegrees(origin, nearest), headingDegrees)

      return offset < 0
        ? { ...counts, left: counts.left + cluster.length }
        : { ...counts, right: counts.right + cluster.length }
    },
    { left: 0, right: 0 }
  )

/**
 * Write a distance the way a person walking would say it.
 * @param meters The distance
 * @returns A short label, metres below a kilometre and kilometres above it
 */
export const formatDistance = (meters: number): string =>
  meters < METERS_IN_A_KILOMETER
    ? `${Math.round(meters)} m`
    : `${(meters / METERS_IN_A_KILOMETER).toFixed(1)} km`
