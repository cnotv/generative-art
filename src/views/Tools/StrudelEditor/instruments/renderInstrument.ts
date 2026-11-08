import { INSTRUMENT_KINDS } from './config'
import { renderDrumSample } from './drumKit'
import { renderOrganSample } from './organ'
import { readNoteSeed, renderStringSample } from './stringInstruments'
import type {
  InstrumentArticulationDefinition,
  InstrumentKnobs,
  InstrumentPreset,
  InstrumentSound
} from './types'

type SoundRequest = {
  articulation: InstrumentArticulationDefinition
  noteName: string | null
}

/**
 * Every sound a preset holds, by articulation and note, with no audio rendered yet.
 * @param preset - a preset
 * @returns one entry per articulation and sampled note, or per unpitched sound
 */
export const listInstrumentSounds = (
  preset: InstrumentPreset
): (SoundRequest & { soundName: string })[] =>
  INSTRUMENT_KINDS[preset.kind].articulations.flatMap((articulation) =>
    (articulation.notes.length === 0 ? [null] : articulation.notes).map((noteName) => ({
      articulation,
      noteName,
      soundName: `${preset.name}_${articulation.id}`
    }))
  )

/**
 * Renders one sound of a preset.
 * @param preset - the preset and its knobs
 * @param request - an entry from `listInstrumentSounds`
 * @returns the left and right channels
 */
export const renderInstrumentSound = (
  preset: InstrumentPreset,
  { articulation, noteName }: SoundRequest
): Float32Array[] => {
  const { durationSeconds, peak } = articulation
  const knobs: InstrumentKnobs = preset.knobs
  if (preset.kind === 'drum-kit') {
    return renderDrumSample({
      articulationId: articulation.id,
      durationSeconds,
      peak,
      knobs,
      seed: articulation.id.length * 31
    })
  }
  const note = noteName ?? 'c4'
  const seed = readNoteSeed(note)
  return preset.kind === 'organ'
    ? renderOrganSample({ noteName: note, durationSeconds, peak, knobs, seed })
    : renderStringSample({
        kind: preset.kind,
        articulationId: articulation.id,
        noteName: note,
        durationSeconds,
        peak,
        knobs,
        seed
      })
}

/**
 * Renders a whole preset: every articulation at every sampled pitch.
 * @param preset - the preset and its knobs
 * @returns each sound's name, note and stereo channels
 */
export const buildInstrumentBank = (preset: InstrumentPreset): InstrumentSound[] =>
  listInstrumentSounds(preset).map((request) => ({
    soundName: request.soundName,
    noteName: request.noteName,
    channels: renderInstrumentSound(preset, request)
  }))
