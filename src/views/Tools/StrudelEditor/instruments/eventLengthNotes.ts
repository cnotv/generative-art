import { isRecordModule, requireCallable, requireRecordModule, toCallable } from '../strudelModules'
import { INSTRUMENT_KINDS, INSTRUMENT_NOTE_LENGTH_CONTROLS } from './config'
import type { InstrumentPreset } from './types'

/**
 * A pitched preset note ends with its event, as a soundfont note does, unless the pattern says
 * how long it lasts. Without this every note rang its whole sample, seconds of fuzz under the
 * next ones, and a busy line summed past full scale and clipped.
 * @param hapValue - the event's values as superdough receives them
 * @returns the values, with `clip: 1` added when no length control is set
 */
export const endNoteAtEvent = (hapValue: Record<string, unknown>): Record<string, unknown> =>
  INSTRUMENT_NOTE_LENGTH_CONTROLS.some((control) => hapValue[control] !== undefined)
    ? hapValue
    : { ...hapValue, clip: 1 }

/**
 * Turns a technique named in the pattern, as in `s("chainsaw:mute")`, into the sample index the
 * combined sound is registered with. Mini notation hands the word over as `n`.
 * @param hapValue - the event's values as superdough receives them
 * @param techniqueIds - the preset kind's techniques, in sample index order
 * @returns the values with a word in `n` replaced by its index; an unknown word picks the first
 * technique, and a number or nothing is left alone
 */
export const readTechniqueIndex = (
  hapValue: Record<string, unknown>,
  techniqueIds: string[]
): Record<string, unknown> =>
  typeof hapValue.n === 'string'
    ? { ...hapValue, n: Math.max(0, techniqueIds.indexOf(hapValue.n)) }
    : hapValue

/**
 * The preset's sounds that play notes; a drum keeps ringing its whole sample.
 * @param preset - a preset
 * @returns its pitched sound names: the combined sound named after the preset, then each
 * articulation such as `chainsaw_note`
 */
export const readPitchedSoundNames = (preset: InstrumentPreset): string[] => {
  const articulationNames = INSTRUMENT_KINDS[preset.kind].articulations
    .filter(({ notes }) => notes.length > 0)
    .map(({ id }) => `${preset.name}_${id}`)
  return articulationNames.length > 0 ? [preset.name, ...articulationNames] : []
}

/**
 * Registers each pitched sound of a preset again with a trigger that applies `endNoteAtEvent`,
 * keeping its data, so the sounds tab and the pickers still read it as the same sample. The
 * combined sound also takes its techniques by name.
 * @param webaudioModule - the loaded `@strudel/webaudio` module
 * @param preset - the preset whose sounds `samples` already registered
 */
export const makeNotesEndAtEvent = (
  webaudioModule: Record<string, unknown>,
  preset: InstrumentPreset
): void => {
  const techniqueIds = INSTRUMENT_KINDS[preset.kind].techniques
  const soundMap = requireRecordModule(webaudioModule.soundMap)
  const sounds = requireRecordModule(requireCallable(soundMap.get).call(soundMap))
  const registerSound = requireCallable(webaudioModule.registerSound)
  readPitchedSoundNames(preset).forEach((soundName) => {
    const sound = sounds[soundName]
    const onTrigger = isRecordModule(sound) ? toCallable(sound.onTrigger) : undefined
    if (onTrigger === undefined || !isRecordModule(sound)) {
      return
    }
    registerSound(
      soundName,
      (time: unknown, hapValue: unknown, onEnded: unknown) =>
        onTrigger(
          time,
          isRecordModule(hapValue)
            ? endNoteAtEvent(
                soundName === preset.name ? readTechniqueIndex(hapValue, techniqueIds) : hapValue
              )
            : hapValue,
          onEnded
        ),
      sound.data
    )
  })
}
