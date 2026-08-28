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
}

/** A street's centre line, as the chain of points the map draws it through. */
export interface StreetPath {
  id: string
  name: string
  points: GeoPoint[]
}

/** A run of a street that stays in front of the camera, in frame percentages. */
export interface StreetRun {
  id: string
  name: string
  points: { xPercent: number; yPercent: number }[]
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
