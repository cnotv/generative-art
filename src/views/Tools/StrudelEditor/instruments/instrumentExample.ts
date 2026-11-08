import { INSTRUMENT_KINDS } from './config'
import type { InstrumentPreset } from './types'

/**
 * The example Strudel code for a preset: the text the tab shows, copies, plays and downloads, so
 * pasting it into the editor sounds the same as the preview.
 * @param preset - the preset the example names
 * @returns complete Strudel code, one cycle long
 */
export const buildInstrumentExample = (preset: InstrumentPreset): string =>
  INSTRUMENT_KINDS[preset.kind].example.replaceAll('{name}', preset.name)
