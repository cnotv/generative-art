import type { CoordinateTuple } from '@webgamekit/threejs'

export type PrimitiveShape = 'cube' | 'ball' | 'cylinder'

/** One primitive of a composed model, measured in cells so it scales with the grid. */
export interface ModelPart {
  shape: PrimitiveShape
  /** Width, height and depth, in cells. */
  size: CoordinateTuple
  /** Where the part's underside sits, in cells from the centre of the cell at ground level. */
  offset: CoordinateTuple
  color: number
}

/** A city component the editor stamps into one cell, built from a handful of primitives. */
export interface CityModel {
  value: string
  label: string
  /** The colour that stands for the model in the palette. */
  swatch: number
  parts: ModelPart[]
}
