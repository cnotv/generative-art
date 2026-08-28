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

/** One square of the grid, as integer indices rather than world coordinates. */
export type CellIndex = [number, number]

/** Whether a pointer stroke fills the cells it crosses or empties them. */
export type PaintMode = 'placing' | 'erasing'

/** The cell a stroke is acting on, keyed for lookup and centred for placement. */
export interface PaintTarget {
  cellKey: string
  x: number
  z: number
}

/** Every cell one component fills in a laid-out preset. */
export interface LayoutPiece {
  model: string
  cells: CellIndex[]
}

/** A board someone can load instead of starting from an empty grid. */
export interface LayoutPreset {
  name: string
  /** The board the layout was drawn for, applied when it loads so every cell fits. */
  boardSize: number
  pieces: LayoutPiece[]
}
