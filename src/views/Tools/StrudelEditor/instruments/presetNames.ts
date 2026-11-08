import {
  INSTRUMENT_NAME_ERRORS,
  INSTRUMENT_NAME_MAX_LENGTH,
  INSTRUMENT_NAME_PATTERN
} from './config'
import type { InstrumentNameCheck } from './types'

/**
 * Whether a preset name can be used. A name becomes the front of its sound names, so it must be
 * a plain word, must not repeat another preset and must not hide a sound Strudel already has.
 * @param name - the wanted name
 * @param otherPresetNames - the names of the other presets
 * @param foreignSoundNames - registered sounds that are not presets' own
 * @returns valid, or a message saying what to change
 */
export const checkInstrumentPresetName = (
  name: string,
  otherPresetNames: string[],
  foreignSoundNames: string[]
): InstrumentNameCheck => {
  if (name.length === 0) {
    return { valid: false, message: INSTRUMENT_NAME_ERRORS.empty }
  }
  if (!INSTRUMENT_NAME_PATTERN.test(name)) {
    return { valid: false, message: INSTRUMENT_NAME_ERRORS.shape }
  }
  if (name.length > INSTRUMENT_NAME_MAX_LENGTH) {
    return { valid: false, message: INSTRUMENT_NAME_ERRORS.tooLong }
  }
  if (otherPresetNames.includes(name)) {
    return { valid: false, message: INSTRUMENT_NAME_ERRORS.taken }
  }
  const collides = foreignSoundNames.some(
    (soundName) => soundName === name || soundName.startsWith(`${name}_`)
  )
  return collides ? { valid: false, message: INSTRUMENT_NAME_ERRORS.soundTaken } : { valid: true }
}
