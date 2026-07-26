import type * as THREE from 'three'

/** A single frame along a sweep path: where the cross-section sits and how it is oriented. */
export type SweepStation = {
  origin: THREE.Vector3
  orientation: THREE.Quaternion
}

/** Closed 2D outline swept along the stations, as [x, y] pairs in the station's local plane. */
export type CrossSection = [number, number][]
