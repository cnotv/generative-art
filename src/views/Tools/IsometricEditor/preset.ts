import type { CellIndex, CellRun, LayoutPreset, PresetPlacement } from './types'

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index)

/**
 * Expand one rectangle of a layout into the cells it covers
 * @param run The rectangle, as `[fromX, toX, fromZ, toZ]` inclusive
 * @returns Every cell inside it
 */
export const expandRun = ([fromX, toX, fromZ, toZ]: CellRun): CellIndex[] =>
  range(fromX, toX).flatMap((cellX) => range(fromZ, toZ).map((cellZ): CellIndex => [cellX, cellZ]))

/**
 * Every cell a layout fills, paired with the component that fills it
 * @param preset The layout to read
 * @returns One entry per cell, in the order the layout lists them
 */
export const getPresetPlacements = (preset: LayoutPreset): PresetPlacement[] =>
  preset.pieces.flatMap((piece) =>
    piece.runs.flatMap(expandRun).map((cell) => ({ model: piece.model, cell }))
  )
