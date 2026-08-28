import type { DeviceAim } from '@webgamekit/controls'
import type { FieldOfView, GeoPoint, PlacedLabel, Place, StreetPath, StreetRun } from './types'

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
const getBearingOffset = (bearingDegrees: number, headingDegrees: number): number =>
  ((bearingDegrees - headingDegrees + HALF_TURN_DEGREES * 3) % FULL_TURN_DEGREES) -
  HALF_TURN_DEGREES

/**
 * The vertical view a camera takes in, which follows from the horizontal one and the shape of
 * the frame rather than being reported separately.
 * @param horizontalDegrees The horizontal field of view
 * @param aspectRatio Frame width divided by its height
 * @returns The vertical field of view in degrees
 */
export const getVerticalFieldOfView = (horizontalDegrees: number, aspectRatio: number): number =>
  2 *
  Math.atan(Math.tan((horizontalDegrees * DEGREES_TO_RADIANS) / 2) / aspectRatio) *
  RADIANS_TO_DEGREES

const FRAME_CENTER_PERCENT = 50
const FRAME_HALF_PERCENT = 50

/**
 * How far below the horizon the foot of something standing on the ground appears.
 *
 * Without this every label sits on one line and the near ones bury the far ones, which is both
 * unreadable and wrong: what is a few paces away really is near your feet, and what is streets
 * away really is on the horizon.
 * @param distanceMeters How far off the place is
 * @param eyeHeightMeters How high the camera is held
 * @returns Elevation in degrees, negative because the ground is below the eye
 */
export const getGroundElevation = (distanceMeters: number, eyeHeightMeters: number): number =>
  -Math.atan2(eyeHeightMeters, Math.max(distanceMeters, 0)) * RADIANS_TO_DEGREES

/**
 * Where a direction lands on the frame for a given aim.
 *
 * A lens draws the world in perspective, so the mapping from angle to pixel is a tangent and
 * not a proportion: a label half a field of view off centre belongs at the frame edge, and one
 * a quarter of the way off belongs nearer the middle than a straight division would put it.
 * The two axes are not independent either, which is why this projects the direction through
 * the camera rather than scaling each angle on its own.
 *
 * The roll is deliberately ignored: every label turns by the same amount, so the layer holding
 * them turns once instead of each label being placed into an already-turned frame.
 * @param bearingDegrees Compass bearing of the place
 * @param elevationDegrees How far the place sits above the horizon, negative below it
 * @param aim Where the camera points
 * @param fieldOfView How much the camera takes in
 * @returns Position as percentages of the frame, and whether it falls inside it at all
 */
export const getScreenPlacement = (
  bearingDegrees: number,
  elevationDegrees: number,
  aim: Pick<DeviceAim, 'headingDegrees' | 'pitchDegrees'>,
  fieldOfView: FieldOfView
): { xPercent: number; yPercent: number; isInView: boolean; isInFront: boolean } => {
  const bearing = getBearingOffset(bearingDegrees, aim.headingDegrees) * DEGREES_TO_RADIANS
  const elevation = elevationDegrees * DEGREES_TO_RADIANS
  const pitch = aim.pitchDegrees * DEGREES_TO_RADIANS
  const halfWidth = Math.tan((fieldOfView.horizontalDegrees / 2) * DEGREES_TO_RADIANS)
  const halfHeight = Math.tan((fieldOfView.verticalDegrees / 2) * DEGREES_TO_RADIANS)

  // The place as a direction, then that direction tipped into the camera's own frame by the
  // angle the camera is raised.
  const right = Math.sin(bearing) * Math.cos(elevation)
  const forward =
    Math.cos(bearing) * Math.cos(elevation) * Math.cos(pitch) +
    Math.sin(elevation) * Math.sin(pitch)
  const up =
    Math.sin(elevation) * Math.cos(pitch) -
    Math.cos(bearing) * Math.cos(elevation) * Math.sin(pitch)

  const horizontal = right / forward
  const vertical = -up / forward

  return {
    xPercent: FRAME_CENTER_PERCENT + (horizontal / halfWidth) * FRAME_HALF_PERCENT,
    yPercent: FRAME_CENTER_PERCENT + (vertical / halfHeight) * FRAME_HALF_PERCENT,
    // Behind the camera the division flips sign and would otherwise fold the place back into
    // the frame, facing the wrong way.
    isInView: forward > 0 && Math.abs(horizontal) <= halfWidth && Math.abs(vertical) <= halfHeight,
    // A label off the edge of the frame is simply not drawn, but a line running off it still has
    // to be drawn to where it leaves, so being in front is asked separately from being in view.
    isInFront: forward > 0
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

/**
 * Project street centre lines onto the frame as runs that stay in front of the camera.
 *
 * A street crossing behind the viewer would otherwise fold back into the frame as a line running
 * the wrong way, so a path is cut wherever it passes the camera plane and comes back as separate
 * runs. Every point is put on the ground at eye height, which is what makes the lines converge
 * toward the horizon the way the street does.
 * @param paths The street centre lines
 * @param origin Where the viewer is
 * @param aim Where the camera points
 * @param fieldOfView How much the camera takes in
 * @param eyeHeightMeters How high the camera is held
 * @returns Drawable runs, in frame percentages
 */
export const projectStreets = (
  paths: readonly StreetPath[],
  origin: GeoPoint,
  aim: Pick<DeviceAim, 'headingDegrees' | 'pitchDegrees'>,
  fieldOfView: FieldOfView,
  eyeHeightMeters: number
): StreetRun[] =>
  paths.flatMap((path) => {
    const placed = path.points.map((point) => {
      const distanceMeters = getDistanceMeters(origin, point)
      const elevation = getGroundElevation(distanceMeters, eyeHeightMeters)

      return getScreenPlacement(getBearingDegrees(origin, point), elevation, aim, fieldOfView)
    })

    const runs = placed.reduce<{ xPercent: number; yPercent: number }[][]>(
      (collected, { xPercent, yPercent, isInFront }) => {
        if (!isInFront) return [...collected, []]
        const current = collected[collected.length - 1]

        return [...collected.slice(0, -1), [...current, { xPercent, yPercent }]]
      },
      [[]]
    )

    return runs
      .filter((points) => points.length >= 2)
      .map((points, index) => ({ id: `${path.id}/${index}`, name: path.name, points }))
  })

/**
 * Where to write each street's name: on the run, once per name, nearest the viewer.
 *
 * Drawn as ordinary elements rather than inside the line drawing, whose viewBox is stretched to
 * the frame and would stretch the lettering with it. One street arrives as many ways, so the
 * nearest run wins the name and the rest go unnamed.
 * @param runs The projected street runs
 * @returns One position per distinct name
 */
export const getStreetNamePositions = (
  runs: readonly StreetRun[]
): { id: string; name: string; xPercent: number; yPercent: number }[] =>
  runs.reduce<{ id: string; name: string; xPercent: number; yPercent: number }[]>((named, run) => {
    if (!run.name || named.some(({ name }) => name === run.name)) return named

    // The lowest point of the run is its nearest, since the ground rises toward the horizon.
    const anchor = run.points.reduce((lowest, point) =>
      point.yPercent > lowest.yPercent ? point : lowest
    )

    return [...named, { id: run.id, name: run.name, ...anchor }]
  }, [])

/**
 * Lift labels off each other where they would land in the same place.
 *
 * A street of shops is a row of names a few metres apart, and their true positions overlap into
 * an unreadable smear. Each one that shares a column with something already placed rises a row
 * above it, which is the direction the frame has room in and the one that already means
 * "further away".
 * @param labels The labels, nearest first, since the nearest keeps its true position
 * @param rowHeightPercent How far a lifted label rises
 * @param columnWidthPercent How close two labels have to be to count as sharing a column
 * @returns The same labels, lifted clear of each other
 */
export const spreadLabels = (
  labels: readonly PlacedLabel[],
  rowHeightPercent: number,
  columnWidthPercent: number
): PlacedLabel[] =>
  labels.reduce<PlacedLabel[]>((placed, label) => {
    const sharingColumn = placed.filter(
      (other) => Math.abs(other.xPercent - label.xPercent) < columnWidthPercent
    ).length

    // Held inside the frame. A landscape phone is short, and a stack of five lifted off one
    // horizon runs straight off the top edge, where an overlapping label would at least be read.
    const lifted = label.yPercent - sharingColumn * rowHeightPercent

    return [...placed, { ...label, yPercent: Math.max(lifted, rowHeightPercent) }]
  }, [])

/**
 * Place every visible thing on the frame.
 *
 * Only the nearest few survive, because a city centre has more names within reach than a phone
 * screen has room for, and they are returned furthest first so the nearest label draws on top.
 * @param places Everything found nearby
 * @param origin Where the viewer is
 * @param aim Where the camera points
 * @param fieldOfView How much the camera takes in
 * @param limits The eye height to measure from, how many labels fit, and how far apart they sit
 * @returns The labels to draw, furthest first
 */
export const placeLabels = (
  places: readonly Place[],
  origin: GeoPoint,
  aim: Pick<DeviceAim, 'headingDegrees' | 'pitchDegrees'>,
  fieldOfView: FieldOfView,
  limits: {
    eyeHeightMeters: number
    maximumLabels: number
    rowHeightPercent: number
    columnWidthPercent: number
  }
): PlacedLabel[] => {
  const nearestFirst = places
    .flatMap((place) => {
      const bearingDegrees = getBearingDegrees(origin, place)
      const distanceMeters = getDistanceMeters(origin, place)
      const elevation = getGroundElevation(distanceMeters, limits.eyeHeightMeters)
      const { xPercent, yPercent, isInView } = getScreenPlacement(
        bearingDegrees,
        elevation,
        aim,
        fieldOfView
      )

      return isInView ? [{ place, bearingDegrees, distanceMeters, xPercent, yPercent }] : []
    })
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, limits.maximumLabels)

  return spreadLabels(nearestFirst, limits.rowHeightPercent, limits.columnWidthPercent).sort(
    (first, second) => second.distanceMeters - first.distanceMeters
  )
}

/**
 * Write a distance the way a person walking would say it.
 * @param meters The distance
 * @returns A short label, metres below a kilometre and kilometres above it
 */
export const formatDistance = (meters: number): string =>
  meters < METERS_IN_A_KILOMETER
    ? `${Math.round(meters)} m`
    : `${(meters / METERS_IN_A_KILOMETER).toFixed(1)} km`
