import type { GeoPoint, MinimapView, Place, StreetPath } from './types'

const DEGREES_TO_RADIANS = Math.PI / 180
const METERS_PER_DEGREE_LATITUDE = 111_320
const MAP_CENTER = 50
const MAP_HALF = 50

/**
 * Where a position sits on a north-up map drawn around the viewer.
 *
 * A plain plate carrée projection: over the couple of hundred metres a minimap covers, the
 * curvature is far below one pixel, and the cosine correction on longitude is the only thing
 * that matters for the map not to look stretched.
 * @param origin Where the viewer is, which is the centre of the map
 * @param point The position to place
 * @param radiusMeters What the map's half-width covers on the ground
 * @returns Position in a hundred-unit square, north up
 */
export const getMinimapPoint = (
  origin: GeoPoint,
  point: GeoPoint,
  radiusMeters: number
): { x: number; y: number } => {
  const northMeters = (point.latitude - origin.latitude) * METERS_PER_DEGREE_LATITUDE
  const eastMeters =
    (point.longitude - origin.longitude) *
    METERS_PER_DEGREE_LATITUDE *
    Math.cos(origin.latitude * DEGREES_TO_RADIANS)
  const scale = MAP_HALF / radiusMeters

  // The map's vertical axis counts downward, and north is up, so the sign flips.
  return { x: MAP_CENTER + eastMeters * scale, y: MAP_CENTER - northMeters * scale }
}

/**
 * Build the plan view drawn in the corner: the streets around you, what is on them, and you.
 *
 * Drawn from the same street geometry and places the overlay already holds rather than from map
 * tiles. There is nothing to fetch, no key to hold and no usage policy to honour, and the map
 * cannot disagree with the labels because it is the same data.
 * @param streets The street centre lines
 * @param places The named places
 * @param origin Where the viewer is
 * @param radiusMeters What the map's half-width covers on the ground
 * @returns Everything that falls on the map, in a hundred-unit square, north up
 */
export const buildMinimap = (
  streets: readonly StreetPath[],
  places: readonly Place[],
  origin: GeoPoint,
  radiusMeters: number
): MinimapView => {
  const isOnMap = ({ x, y }: { x: number; y: number }): boolean =>
    x >= 0 && x <= 100 && y >= 0 && y <= 100

  return {
    streets: streets.flatMap((street) => {
      const points = street.points.map((point) => getMinimapPoint(origin, point, radiusMeters))

      // Kept whole when any part of it lands, so a road crossing the map is not chopped at the
      // edge; the map clips it instead.
      return points.some(isOnMap) ? [{ id: street.id, points }] : []
    }),
    places: places.flatMap((place) => {
      const point = getMinimapPoint(origin, place, radiusMeters)

      return isOnMap(point) ? [{ id: place.id, group: place.group, ...point }] : []
    })
  }
}
