import { PHOTON_ENDPOINT, UNPLACEABLE_TYPES, getPlaceGroup } from './config'
import type { GeoPoint, Place } from './types'

const METERS_IN_A_KILOMETER = 1000

/** The geocoder abbreviates the three OpenStreetMap element types; a link needs them spelled. */
const OSM_TYPE_NAMES: Record<string, string> = { N: 'node', W: 'way', R: 'relation' }

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
 * The path a place has on the map site, or nothing where it cannot be linked to.
 *
 * Built here and left null when either half is missing, rather than composing a URL that answers
 * with a not-found page: the geocoder returns some features with no usable element behind them.
 * @param osmType The abbreviated element type, `N`, `W` or `R`
 * @param osmId The element's numeric id, as it arrived
 * @returns Something like `node/12`, or null
 */
const getOsmReference = (osmType: string, osmId: unknown): string | null =>
  OSM_TYPE_NAMES[osmType] && typeof osmId === 'number'
    ? `${OSM_TYPE_NAMES[osmType]}/${osmId}`
    : null

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
  const osmType = readString(properties.osm_type) ?? ''
  const osmId = properties.osm_id

  return {
    id: `${osmType || 'X'}${String(osmId ?? name)}`,
    osmReference: getOsmReference(osmType, osmId),
    name,
    category: tagValue || kind || 'place',
    group: getPlaceGroup(tagKey, tagValue, kind),
    houseNumber: readString(properties.housenumber),
    street: readString(properties.street),
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

/** The street and house number a place shares its address with, or null where it has neither. */
const getAddressKey = (place: Place): string | null =>
  place.street && place.houseNumber ? `${place.street} ${place.houseNumber}` : null

const average = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length

/**
 * Merge tenants of the same building into one place, so a shop directory does not draw a
 * pin per name.
 *
 * A house number alone is not enough, since two different streets can both have a number 12;
 * only a place carrying both is treated as sharing an address, and everything else is left as
 * it was.
 * @param places Everything found, already resolved to individual businesses
 * @returns One place per address shared by more than one, standing among the rest untouched
 */
export const groupPlacesByAddress = (places: readonly Place[]): Place[] => {
  const byAddress = places.reduce<Map<string, Place[]>>((groups, place) => {
    const key = getAddressKey(place)
    if (!key) return groups

    return new Map(groups).set(key, [...(groups.get(key) ?? []), place])
  }, new Map())

  const shared = [...byAddress.values()].filter((tenants) => tenants.length > 1)
  const groupedIds = new Set(shared.flatMap((tenants) => tenants.map(({ id }) => id)))

  const merged = shared.map((tenants) => ({
    ...tenants[0],
    id: tenants.map(({ id }) => id).join('+'),
    name: tenants.map(({ name }) => name).join(', '),
    category: `${tenants.length} places`,
    osmReference: null,
    latitude: average(tenants.map(({ latitude }) => latitude)),
    longitude: average(tenants.map(({ longitude }) => longitude))
  }))

  return [...places.filter(({ id }) => !groupedIds.has(id)), ...merged]
}
