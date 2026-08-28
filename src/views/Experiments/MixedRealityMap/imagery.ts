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

/**
 * Read the nearest article that actually has a picture.
 *
 * The generator orders its pages by distance and most of them carry no image at all, so the
 * first with a thumbnail wins rather than the first outright.
 * @param payload The parsed JSON body
 * @returns The picture, or null where nothing nearby has one
 */
export const parsePlaceImage = (payload: unknown): PlaceImage | null => {
  if (!isRecord(payload) || !isRecord(payload.query) || !isRecord(payload.query.pages)) return null

  const withPictures = Object.values(payload.query.pages)
    .flatMap((page) => {
      if (!isRecord(page) || !isRecord(page.thumbnail)) return []
      const { title, thumbnail, index } = page
      const source = thumbnail.source
      if (typeof title !== 'string' || typeof source !== 'string') return []

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
 * @param radiusMeters How far around it to look
 * @param thumbnailWidth How wide a picture to ask for
 * @param signal Abort signal, so tapping another place cancels the one before it
 * @returns The picture, or null where nothing nearby has one
 */
export const fetchPlaceImage = async (
  point: GeoPoint,
  radiusMeters: number,
  thumbnailWidth: number,
  signal?: AbortSignal
): Promise<PlaceImage | null> => {
  const response = await fetch(buildImageUrl(point, radiusMeters, thumbnailWidth), { signal })
  if (!response.ok) throw new Error(`The picture service answered ${response.status}`)

  return parsePlaceImage(await response.json())
}
