import { INSTRUMENT_KINDS, INSTRUMENT_KIND_IDS } from './config'
import type { InstrumentKind, InstrumentPreset } from './types'

/**
 * Narrows text to one of the instrument kinds.
 * @param value - any text
 * @returns true when it names a kind
 */
export const isInstrumentKind = (value: string): value is InstrumentKind =>
  INSTRUMENT_KIND_IDS.some((kind) => kind === value)

const STRING_LITERAL_PATTERN = /"([^"]*)"|'([^']*)'|`([^`]*)`/g

const readStringLiterals = (code: string): string[] =>
  [...code.matchAll(STRING_LITERAL_PATTERN)].map(
    ([, double = '', single = '', template = '']) => `${double}${single}${template}`
  )

/**
 * The presets a piece of code plays, found by their sound names: `<preset>_<articulation>`
 * anywhere, and the bare preset name, with or without a `:index`, inside a string.
 * Only these are rendered before the code runs, so an unused preset costs nothing.
 * @param code - Strudel code about to be played or exported
 * @param presets - every preset there is
 * @returns the presets whose sounds the code names, in the order of `presets`
 */
export const findReferencedInstrumentPresets = (
  code: string,
  presets: InstrumentPreset[]
): InstrumentPreset[] => {
  const strings = readStringLiterals(code)
  return presets.filter(({ name, kind }) => {
    const { articulations, techniques } = INSTRUMENT_KINDS[kind]
    const articulationIds = articulations.map(({ id }) => id)
    // Names are letters and digits only, so they are safe to put in a pattern.
    const articulationPattern = new RegExp(`\\b${name}_(?:${articulationIds.join('|')})\\b`)
    const barePattern = new RegExp(`(?<![\\w.])${name}(?::\\d+)?(?!\\w)`)
    return (
      articulationPattern.test(code) ||
      (techniques.length > 0 && strings.some((text) => barePattern.test(text)))
    )
  })
}
