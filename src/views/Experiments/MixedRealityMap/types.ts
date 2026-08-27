export interface GeoPoint {
  latitude: number
  longitude: number
}

/** A named thing on the map, reduced to what it takes to draw a label for it. */
export interface Place extends GeoPoint {
  id: string
  name: string
  category: string
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

/** How wide a view the camera takes in, which no browser API reports. */
export interface FieldOfView {
  horizontalDegrees: number
  verticalDegrees: number
}

export type PermissionStage = 'idle' | 'requesting' | 'ready' | 'blocked'
