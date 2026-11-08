import { INSTRUMENT_KINDS, INSTRUMENT_KIND_IDS } from './config'
import type { InstrumentKind, InstrumentPreset } from './types'

/**
 * Narrows text to one of the instrument kinds.
 * @param value - any text
 * @returns true when it names a kind
 */
export const isInstrumentKind = (value: string): value is InstrumentKind =>
  INSTRUMENT_KIND_IDS.some((kind) => kind === value)

/**
 * The presets a piece of code plays, found by their sound names (`<preset>_<articulation>`).
 * Only these are rendered before the code runs, so an unused preset costs nothing.
 * @param code - Strudel code about to be played or exported
 * @param presets - every preset there is
 * @returns the presets whose sounds the code names, in the order of `presets`
 */
export const findReferencedInstrumentPresets = (
  code: string,
  presets: InstrumentPreset[]
): InstrumentPreset[] =>
  presets.filter(({ name, kind }) => {
    const articulationIds = INSTRUMENT_KINDS[kind].articulations.map(({ id }) => id)
    // Names are letters and digits only, so they are safe to put in a pattern.
    return new RegExp(`\\b${name}_(?:${articulationIds.join('|')})\\b`).test(code)
  })
