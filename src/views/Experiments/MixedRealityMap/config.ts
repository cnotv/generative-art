/**
 * Komoot's reverse geocoder over OpenStreetMap: free, no key, no sign-up, and it answers with
 * an open CORS header, which a page doing all its own fetching needs.
 *
 * Overpass is the more obvious choice and was the first one tried, but its public mirrors time
 * out under load often enough that the view spent more time apologising than labelling.
 */
export const PHOTON_ENDPOINT = 'https://photon.komoot.io/reverse'

/**
 * Street centre lines come from Overpass, because it is the only free service that returns
 * geometry rather than a single point per feature. Its public mirrors are unreliable enough
 * that the paths are treated as a bonus: when the query fails there are simply no lines.
 */
export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

/**
 * How far out to look. Far enough to reach the other side of a square, short enough that the
 * labels still describe what is actually in front of the camera rather than a haze of names.
 */
export const SEARCH_RADIUS_METERS = 400

/** A city centre has hundreds within reach, and the screen fits a handful. */
export const MAX_PLACES = 80

/**
 * Street lines are drawn from much closer in than the labels.
 *
 * From eye height the ground falls away fast: a street two hundred metres off sits half a degree
 * below the horizon, and every street past that piles into the same few pixels of it. Only the
 * ones near enough to have visible shape are worth drawing, and the rest are a smear.
 */
export const STREET_RADIUS_METERS = 120

/** How many labels the frame will hold before it stops being readable. */
export const MAX_VISIBLE_LABELS = 12

/** Where a phone is held, which decides how far below the horizon a nearby place sits. */
export const EYE_HEIGHT_METERS = 1.6

/**
 * How wide to lay a street down. A carriageway with its pavements is about this, and drawing it
 * at a real width is what makes it lie on the ground and narrow into the distance rather than
 * read as a wire strung across the picture.
 */
export const STREET_WIDTH_METERS = 12

/** The footprint of a marker box, roughly a shopfront, so it shrinks with distance like one. */
export const PLACE_MARKER_METERS = 6

/**
 * How upright the phone has to be before its roll is worth believing. Below this the plumb line
 * points through the screen, there is no horizon, and the reported roll is sensor noise.
 */
export const MINIMUM_HORIZON_STRENGTH = 0.2

/** Roughly one label's height and width, as a share of the frame, for lifting them apart. */
export const LABEL_ROW_HEIGHT_PERCENT = 7
export const LABEL_COLUMN_WIDTH_PERCENT = 30

/**
 * Things too large to stand anywhere in particular. A city's point is wherever its centre was
 * drawn, so labelling it puts "Amsterdam" on one arbitrary building.
 */
export const UNPLACEABLE_TYPES = ['city', 'county', 'state', 'country', 'other'] as const

/**
 * The kinds worth telling apart, in the order they are offered.
 *
 * Grouped by what someone standing in the street is looking for rather than by how
 * OpenStreetMap files it: "somewhere to eat" spans two of its top-level keys, and its `amenity`
 * key spans a restaurant, a bench and a wastebasket.
 */
export const PLACE_GROUPS = [
  { id: 'streets', label: 'Streets', icon: 'Route' },
  { id: 'food', label: 'Food and drink', icon: 'UtensilsCrossed' },
  { id: 'shops', label: 'Shops', icon: 'ShoppingBag' },
  { id: 'landmarks', label: 'Landmarks', icon: 'Landmark' },
  { id: 'other', label: 'Everything else', icon: 'MapPin' }
] as const

const FOOD_VALUES = [
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'fast_food',
  'ice_cream',
  'biergarten',
  'food_court',
  'bakery',
  'confectionery',
  'deli'
]

const LANDMARK_KEYS = ['tourism', 'historic']
const LANDMARK_VALUES = ['artwork', 'monument', 'memorial', 'museum', 'attraction', 'viewpoint']

/**
 * Sort a feature into the group it belongs to, by its OpenStreetMap key and value.
 * @param key The top-level tag, such as `amenity` or `shop`
 * @param value The tag's value, such as `restaurant`
 * @param kind What the geocoder called the feature, such as `street`
 * @returns The group's id
 */
export const getPlaceGroup = (key: string, value: string, kind: string): string => {
  if (kind === 'street' || key === 'highway') return 'streets'
  // A bakery is a shop by its tag and a place to eat by every other measure, so food is asked
  // first and wins it.
  if (FOOD_VALUES.includes(value)) return 'food'
  if (key === 'shop') return 'shops'
  if (LANDMARK_KEYS.includes(key) || LANDMARK_VALUES.includes(value)) return 'landmarks'

  return 'other'
}

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
