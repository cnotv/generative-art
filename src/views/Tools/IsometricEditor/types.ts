import type { CoordinateTuple } from '@webgamekit/threejs'

/** A primitive the editor stamps onto the grid, sized in cells rather than world units. */
export interface PlaceableModel {
  value: string
  label: string
  shape: 'cube' | 'ball' | 'cylinder'
  /** Width, height and depth in cells, so a footprint survives a change of cell size. */
  size: CoordinateTuple
  color: number
}
