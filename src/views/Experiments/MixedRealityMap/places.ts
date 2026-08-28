import { PHOTON_ENDPOINT, UNPLACEABLE_TYPES, getPlaceGroup } from './config'
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
 * Read a GeoJSON point, which writes longitude before latitude.
 * @param geometry The feature's geometry member
 * @returns The position, or null where there is not a usable one
 */
const readPosition = (geometry: unknown): GeoPoint | null => {
  if (!isRecord(geometry) || !Array.isArray(geometry.coordinates)) return null
  const [longitude, latitude] = geometry.coordinates
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null

  return { latitude, longitude }
}

/**
 * Read a single GeoJSON feature, or nothing where it cannot be drawn as a label.
 * @param feature One entry of the feature collection
 * @returns The place, or null
 */
const readPlace = (feature: unknown): Place | null => {
  if (!isRecord(feature) || !isRecord(feature.properties)) return null
  const { properties } = feature

  const name = readString(properties.name)
  const position = readPosition(feature.geometry)
  if (!name || !position) return null

  const kind = readString(properties.type) ?? ''
  if (UNPLACEABLE_TYPES.some((skipped) => skipped === kind)) return null

  const tagKey = readString(properties.osm_key) ?? ''
  const tagValue = readString(properties.osm_value) ?? ''

  return {
    id: `${readString(properties.osm_type) ?? 'X'}${String(properties.osm_id ?? name)}`,
    name,
    category: tagValue || kind || 'place',
    group: getPlaceGroup(tagKey, tagValue, kind),
    ...position
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
