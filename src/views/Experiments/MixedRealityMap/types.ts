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

/** Where a place lands on screen for the aim the device currently holds. */
export interface PlacedLabel {
  place: Place
  distanceMeters: number
  bearingDegrees: number
  /** Percent across the viewport from its left edge. */
  xPercent: number
  /** Percent down the viewport from its top edge. */
  yPercent: number
  /** Where the place actually stands, before any lift to clear other labels. */
  groundPoint: FramePoint
  /** The side of its marker box, as a percent of the frame width, shrinking with distance. */
  boxPercent: number
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
export interface StreetRun {
  id: string
  name: string
  points: FramePoint[]
}

/**
 * A run of a street drawn with its real width, as the closed outline of the road surface.
 * `points` runs up one kerb and back down the other, ready to fill.
 */
export interface StreetRibbon {
  id: string
  name: string
  points: FramePoint[]
  /** Where to write the name: on the centre line, at the near end of the run. */
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

/** How wide a view the camera takes in, which no browser API reports. */
export interface FieldOfView {
  horizontalDegrees: number
  verticalDegrees: number
}

/**
 * There is no blocked stage: the camera, the location and the compass are asked for together
 * and granted separately, so any one of them failing still leaves a view worth showing.
 */
export type PermissionStage = 'idle' | 'requesting' | 'ready'
