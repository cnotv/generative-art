import type { PaintMode } from './types'

/**
 * What a stroke starting on a cell does, held for the whole stroke.
 *
 * A press empties a cell only when it would otherwise place the very thing already standing
 * there, so clicking one component twice takes it away while a different component simply
 * replaces it. Erasing on any mismatch instead would make paving a road over a terrace a
 * two-pass job, which is most of what building a city is.
 *
 * The mode is then fixed for the rest of the stroke, or a road dragged across a planted square
 * would flip to an eraser at the first cell it met and chew a hole through the town.
 * @param selectedModel The palette entry currently chosen
 * @param occupantModel The model already in the cell, if there is one
 * @param eraseModel The palette entry that stands for the eraser
 * @returns Whether the stroke fills the cells it crosses or empties them
 */
export const resolveStrokeMode = (
  selectedModel: string,
  occupantModel: string | undefined,
  eraseModel: string
): PaintMode =>
  selectedModel === eraseModel || selectedModel === occupantModel ? 'erasing' : 'placing'
