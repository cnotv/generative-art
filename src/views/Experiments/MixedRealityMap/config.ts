/**
 * Komoot's reverse geocoder over OpenStreetMap: free, no key, no sign-up, and it answers with
 * an open CORS header, which a page doing all its own fetching needs.
 *
 * Overpass is the more obvious choice and was the first one tried, but its public mirrors time
 * out under load often enough that the view spent more time apologising than labelling.
 */
export const PHOTON_ENDPOINT = 'https://photon.komoot.io/reverse'

/**
 * How far out to look. Far enough to reach the other side of a square, short enough that the
 * labels still describe what is actually in front of the camera rather than a haze of names.
 */
export const SEARCH_RADIUS_METERS = 400

/** A city centre has hundreds within reach, and the screen fits a handful. */
export const MAX_PLACES = 80

/** How many labels the frame will hold before it stops being readable. */
export const MAX_VISIBLE_LABELS = 12

/** Where a phone is held, which decides how far below the horizon a nearby place sits. */
export const EYE_HEIGHT_METERS = 1.6

/** Roughly one label's height and width, as a share of the frame, for lifting them apart. */
export const LABEL_ROW_HEIGHT_PERCENT = 7
export const LABEL_COLUMN_WIDTH_PERCENT = 30

/**
 * Things too large to stand anywhere in particular. A city's point is wherever its centre was
 * drawn, so labelling it puts "Amsterdam" on one arbitrary building.
 */
export const UNPLACEABLE_TYPES = ['city', 'county', 'state', 'country', 'other'] as const

/**
 * Roughly a phone's rear camera, which no browser API will tell us. It is the one number that
 * decides whether a label sits on the building it names, so the view offers it as a control.
 */
export const DEFAULT_HORIZONTAL_FIELD_OF_VIEW = 65
export const MINIMUM_FIELD_OF_VIEW = 30
export const MAXIMUM_FIELD_OF_VIEW = 110

/** How far the compass may be nudged, for the many devices whose magnetometer reads off. */
export const MAXIMUM_HEADING_OFFSET = 180

/** Refetch once the reported position has moved far enough for the results to have changed. */
export const REFETCH_DISTANCE_METERS = 120

export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 20_000
}
