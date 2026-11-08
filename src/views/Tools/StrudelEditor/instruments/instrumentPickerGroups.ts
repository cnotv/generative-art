import { INSTRUMENT_KINDS } from './config'
import type { InstrumentPickerGroups, InstrumentPreset } from './types'

const toDrumSamples = (preset: InstrumentPreset) =>
  INSTRUMENT_KINDS[preset.kind].articulations
    .filter((articulation) => articulation.notes.length === 0)
    .map((articulation) => ({
      value: `${preset.name}_${articulation.id}`,
      // The preset's name leads the label because the picker cuts its group heading short.
      label: `${preset.name} ${articulation.label.toLowerCase()}`,
      familyId: articulation.familyId
    }))

// The combined sound leads, then each technique past the first as the sample index Strudel reads.
const toPitchedSamples = (preset: InstrumentPreset) => {
  const { articulations, techniques } = INSTRUMENT_KINDS[preset.kind]
  const techniqueArticulations = techniques.flatMap((id) =>
    articulations.filter((articulation) => articulation.id === id)
  )
  const [firstTechnique] = techniqueArticulations
  return firstTechnique === undefined
    ? []
    : techniqueArticulations.map((articulation, techniqueIndex) => ({
        value: techniqueIndex === 0 ? preset.name : `${preset.name}:${techniqueIndex}`,
        label:
          techniqueIndex === 0 ? preset.name : `${preset.name} ${articulation.label.toLowerCase()}`,
        familyId: firstTechnique.familyId
      }))
}

const toPresetGroup = (preset: InstrumentPreset, pitched: boolean) => ({
  label: `${INSTRUMENT_KINDS[preset.kind].label}: ${preset.name}`,
  samples: pitched ? toPitchedSamples(preset) : toDrumSamples(preset)
})

/**
 * Every preset's sounds for the flow editor's pickers, whether rendered yet or not: a preset
 * renders only once code plays it, so a list read from the registered sounds would hide it.
 * @param presets - the built-in and the player's own presets
 * @returns the pitched sounds for the Voice node and the unpitched ones for the sample nodes,
 * one group per preset
 */
export const buildInstrumentPickerGroups = (
  presets: InstrumentPreset[]
): InstrumentPickerGroups => ({
  voiceGroups: presets
    .map((preset) => toPresetGroup(preset, true))
    .filter((group) => group.samples.length > 0),
  sampleGroups: presets
    .map((preset) => toPresetGroup(preset, false))
    .filter((group) => group.samples.length > 0)
})
