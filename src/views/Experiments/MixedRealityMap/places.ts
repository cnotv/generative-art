import { PHOTON_ENDPOINT, UNPLACEABLE_TYPES } from './config'
import type { GeoPoint, Place } from './types'

const METERS_IN_A_KILOMETER = 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/**
 * The URL for everything named around a position.
 * @param origin Where the viewer is
 * @param radiusMeters How far out to look
 * @param limit Most results to return
 * @returns The request URL, radius given in the kilometres the service expects
 */
export const buildPlacesUrl = (origin: GeoPoint, radiusMeters: number, limit: number): string => {
  const query = new URLSearchParams({
    lat: String(origin.latitude),
    lon: String(origin.longitude),
    radius: String(radiusMeters / METERS_IN_A_KILOMETER),
    limit: String(limit)
  })

  return `${PHOTON_ENDPOINT}?${query}`
}

/**
 * Read a single GeoJSON feature, or nothing where it cannot be drawn as a label.
 * @param value One entry of the feature collection
 * @returns The place, or null
 */
const readPlace = (value: unknown): Place | null => {
  if (!isRecord(value)) return null
  const { properties, geometry } = value
  if (!isRecord(properties) || !isRecord(geometry)) return null

  const name = readString(properties.name)
  const kind = readString(properties.type)
  const coordinates = geometry.coordinates
  if (!name || !Array.isArray(coordinates)) return null

  const [longitude, latitude] = coordinates
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null
  if (kind !== null && UNPLACEABLE_TYPES.some((skipped) => skipped === kind)) return null

  return {
    id: `${readString(properties.osm_type) ?? 'X'}${String(properties.osm_id ?? name)}`,
    name,
    category: readString(properties.osm_value) ?? kind ?? 'place',
    latitude,
    longitude
  }
}

/**
 * Turn a response into places, discarding anything that cannot be drawn.
 *
 * The response is external data, so every field is read and checked rather than asserted: a
 * geocoder under load answers with an error page often enough that an unchecked cast would be
 * a crash instead of an empty screen.
 *
 * Names repeat, because a square, the footway across it and the cycleway along it are three
 * features of the same name. Only the first survives, which is the closest one.
 * @param payload The parsed JSON body
 * @returns Every feature with a name, a position, and somewhere to stand
 */
export const parsePlaces = (payload: unknown): Place[] => {
  if (!isRecord(payload) || !Array.isArray(payload.features)) return []

  return payload.features.reduce<Place[]>((places, feature) => {
    const place = readPlace(feature)
    if (!place || places.some(({ name }) => name === place.name)) return places

    return [...places, place]
  }, [])
}

/**
 * Fetch the named places around a position.
 * @param origin Where the viewer is
 * @param radiusMeters How far out to look
 * @param limit Most results to return
 * @param signal Abort signal, so a position update can cancel a query it has outrun
 * @returns Every place found
 */
export const fetchNearbyPlaces = async (
  origin: GeoPoint,
  radiusMeters: number,
  limit: number,
  signal?: AbortSignal
): Promise<Place[]> => {
  const response = await fetch(buildPlacesUrl(origin, radiusMeters, limit), { signal })
  if (!response.ok) throw new Error(`The map service answered ${response.status}`)

  return parsePlaces(await response.json())
}
