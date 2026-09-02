export interface GeoPoint {
  latitude: number
  longitude: number
}

/** A named thing on the map, reduced to what it takes to draw a label for it. */
export interface Place extends GeoPoint {
  id: string
  name: string
  /** The word shown under the name, such as `cafe`. */
  category: string
  /** Which of the filter groups it falls in, such as `food`. */
  group: string
  /** `node/12` and the like, for linking to the map; null when the geocoder gave no usable id. */
  osmReference: string | null
  /** The building's number on its street, for grouping tenants of the same address; null when the geocoder gave none. */
  houseNumber: string | null
  /** The street this place fronts on, null when the geocoder gave none. */
  street: string | null
}

/**
 * Where one or more places land on screen for the aim the device currently holds.
 *
 * More than one place when they share a building: one card, its rows independently tappable,
 * rather than a pin per tenant stacked on the same spot.
 */
export interface PlacedLabel {
  id: string
  /** The tenants of this spot, nearest first. Almost always one. */
  places: Place[]
  /** Of the nearest place in the group. */
  distanceMeters: number
  bearingDegrees: number
  /** Percent across the viewport from its left edge. */
  xPercent: number
  /** Percent down the viewport from its top edge, the same row every card starts on. */
  yPercent: number
  /** How much vertical room the card needs, as a percent of the frame height. */
  heightPercent: number
}

/** A street's centre line, as the chain of points the map draws it through. */
export interface StreetPath {
  id: string
  name: string
  points: GeoPoint[]
}

/** A point on the frame, as percentages of its width and height. */
export interface FramePoint {
  xPercent: number
  yPercent: number
}

/** A run of a street that stays in front of the camera, in frame percentages. */
export interface StreetLine {
  id: string
  name: string
  points: FramePoint[]
  /** Where to write the name: somewhere along the middle of the run. */
  namePoint: FramePoint
}

/** The plan view drawn in the corner, in a hundred-unit square with north up. */
export interface MinimapView {
  streets: { id: string; points: { x: number; y: number }[] }[]
  places: { id: string; group: string; x: number; y: number }[]
}

/** A picture of a place, and where it came from. */
export interface PlaceImage {
  title: string
  thumbnailUrl: string
  pageUrl: string
}

/**
 * There is no blocked stage: the camera, the location and the compass are asked for together
 * and granted separately, so any one of them failing still leaves a view worth showing.
 */
export type PermissionStage = 'idle' | 'requesting' | 'ready'
