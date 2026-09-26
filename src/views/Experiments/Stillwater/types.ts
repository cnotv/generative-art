import type { CoordinateTuple } from '@webgamekit/threejs'

/** One stretch of ground or water that gets planted, and how big whatever grows there is. */
export interface PlantingBand {
  name: string
  /** The band's near corner on the ground plane. Y is ignored: `rootLevel` places the roots. */
  min: CoordinateTuple
  /** The band's far corner on the ground plane. */
  max: CoordinateTuple
  count: number
  /** Where the roots sit, below the surface the band covers so nothing hovers over it. */
  rootLevel: number
  minScale: number
  maxScale: number
  /** Fixes both the placement and the variation, so a band looks the same on every load. */
  seed: number
}
