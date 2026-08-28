import { OVERPASS_ENDPOINT } from './config'
import type { GeoPoint, StreetPath } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Ask for the centre lines of the streets within reach.
 *
 * This is the one thing a reverse geocoder cannot answer: it returns a street as a single point,
 * and a path needs the whole chain of nodes. Overpass is asked because it is the only free
 * service that will give geometry, and asked for as little as possible — named roads only,
 * `out geom` for the node chain — because its public mirrors fall over under anything larger.
 * @param origin Where the viewer is
 * @param radiusMeters How far out to look
 * @returns Overpass QL source
 */
export const buildStreetsQuery = (origin: GeoPoint, radiusMeters: number): string =>
  `[out:json][timeout:15];way(around:${radiusMeters},${origin.latitude},${origin.longitude})[highway][name];out geom;`

/**
 * Read the node chains out of an Overpass response.
 *
 * Every field is checked rather than asserted, because a mirror under load answers with an HTML
 * error page often enough that an unchecked cast would be a crash rather than a bare screen.
 * @param payload The parsed JSON body
 * @returns Every way that has at least two points to draw between
 */
export const parseStreetPaths = (payload: unknown): StreetPath[] => {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) return []

  return payload.elements.flatMap((element) => {
    if (!isRecord(element) || !Array.isArray(element.geometry)) return []

    const points = element.geometry.flatMap((point) => {
      if (!isRecord(point)) return []
      const { lat, lon } = point
      if (typeof lat !== 'number' || typeof lon !== 'number') return []

      return [{ latitude: lat, longitude: lon }]
    })

    // A single node draws no line, and a way clipped down to one by the checks above is not a
    // street any more.
    if (points.length < 2) return []

    const tags = isRecord(element.tags) ? element.tags : {}
    const name = typeof tags.name === 'string' ? tags.name : ''

    return [{ id: `way/${String(element.id ?? name)}`, name, points }]
  })
}

/**
 * Fetch the street centre lines around a position.
 * @param origin Where the viewer is
 * @param radiusMeters How far out to look
 * @param signal Abort signal, so a position update can cancel a query it has outrun
 * @returns Every street path found
 */
export const fetchStreetPaths = async (
  origin: GeoPoint,
  radiusMeters: number,
  signal?: AbortSignal
): Promise<StreetPath[]> => {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: new URLSearchParams({ data: buildStreetsQuery(origin, radiusMeters) }),
    signal
  })
  if (!response.ok) throw new Error(`The street service answered ${response.status}`)

  return parseStreetPaths(await response.json())
}
