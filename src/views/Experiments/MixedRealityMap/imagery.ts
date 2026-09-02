import { WIKIPEDIA_ENDPOINT, WIKIPEDIA_PAGE_BASE } from './config'
import type { GeoPoint, PlaceImage } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * The URL for the articles written about a point on the ground.
 *
 * Wikipedia's own search by position, which needs no key and answers with an open cross-origin
 * header. A tight radius, because the question is what this building is rather than what
 * district it stands in.
 * @param point Where the place is
 * @param radiusMeters How far around it to look
 * @param thumbnailWidth How wide a picture to ask for
 * @returns The request URL
 */
export const buildImageUrl = (
  point: GeoPoint,
  radiusMeters: number,
  thumbnailWidth: number
): string => {
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    // Without this the browser is refused rather than served, since the API is cross-origin.
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${point.latitude}|${point.longitude}`,
    ggsradius: String(radiusMeters),
    ggslimit: '5',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(thumbnailWidth)
  })

  return `${WIKIPEDIA_ENDPOINT}?${query}`
}

/** Lowercased and stripped to bare words, so punctuation and case cannot fail a real match. */
const normalizeForMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\da-z]+/g, ' ')
    .trim()

/**
 * Whether an article is actually about the place, rather than merely the nearest thing that
 * happens to have a picture.
 * @param title The article's title
 * @param placeName The tapped place's name
 * @returns True where one name plainly contains the other
 */
const namesMatch = (title: string, placeName: string): boolean => {
  const normalizedTitle = normalizeForMatch(title)
  const normalizedPlace = normalizeForMatch(placeName)

  return (
    normalizedPlace.length > 0 &&
    (normalizedTitle.includes(normalizedPlace) || normalizedPlace.includes(normalizedTitle))
  )
}

/**
 * Read the nearest article that is both pictured and actually about the place.
 *
 * The generator orders its pages by distance, and most of what is nearby is unrelated to the
 * thing that was tapped: a shop with no article of its own sits a few metres from the street,
 * the district, and every other landmark around it, all of which have pictures. Showing the
 * first one anyway put someone else's photograph under the tapped place's name, so a candidate
 * only counts when its title is actually the place, not just nearby it.
 * @param payload The parsed JSON body
 * @param placeName The tapped place's name
 * @returns The picture, or null where nothing nearby is genuinely of the place
 */
export const parsePlaceImage = (payload: unknown, placeName: string): PlaceImage | null => {
  if (!isRecord(payload) || !isRecord(payload.query) || !isRecord(payload.query.pages)) return null

  const withPictures = Object.values(payload.query.pages)
    .flatMap((page) => {
      if (!isRecord(page) || !isRecord(page.thumbnail)) return []
      const { title, thumbnail, index } = page
      const source = thumbnail.source
      if (
        typeof title !== 'string' ||
        typeof source !== 'string' ||
        !namesMatch(title, placeName)
      ) {
        return []
      }

      return [{ title, source, index: typeof index === 'number' ? index : Number.MAX_SAFE_INTEGER }]
    })
    .sort((first, second) => first.index - second.index)

  const nearest = withPictures[0]
  if (!nearest) return null

  return {
    title: nearest.title,
    thumbnailUrl: nearest.source,
    pageUrl: `${WIKIPEDIA_PAGE_BASE}${encodeURIComponent(nearest.title.replace(/ /g, '_'))}`
  }
}

/**
 * Fetch a picture of what stands at a position.
 * @param point Where the place is
 * @param placeName The place's name, so a nearby but unrelated picture is left out
 * @param radiusMeters How far around it to look
 * @param thumbnailWidth How wide a picture to ask for
 * @param signal Abort signal, so tapping another place cancels the one before it
 * @returns The picture, or null where nothing nearby is genuinely of the place
 */
export const fetchPlaceImage = async (
  point: GeoPoint,
  placeName: string,
  radiusMeters: number,
  thumbnailWidth: number,
  signal?: AbortSignal
): Promise<PlaceImage | null> => {
  const response = await fetch(buildImageUrl(point, radiusMeters, thumbnailWidth), { signal })
  if (!response.ok) throw new Error(`The picture service answered ${response.status}`)

  return parsePlaceImage(await response.json(), placeName)
}
