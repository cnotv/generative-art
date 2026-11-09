import { useAiSettings } from '../ai/useAiSettings'
import { askInstrumentToneAssistant } from './instrumentToneAssistant'
import type { createPresetLibrary } from './presetLibrary'
import type { StrudelComposerInstrument, StrudelComposerInstrumentResult } from '../ai/types'

/**
 * Creates a preset the composer designed and sets its knobs with the sound model. A name any
 * preset already has is kept as it is, so the player's own sounds are never overwritten.
 * @param library - the presets and the operations that add one and set its knobs
 * @param instrument - the name, kind and wanted sound the composer gave
 * @returns ready, existed, or failed with the reason; the preset stays at its starting knobs
 * when only the sound model failed
 */
export const designInstrumentPreset = async (
  library: Pick<
    ReturnType<typeof createPresetLibrary>,
    'presets' | 'createPreset' | 'setPresetKnobs'
  >,
  { name, kind, description }: StrudelComposerInstrument
): Promise<StrudelComposerInstrumentResult> => {
  if (library.presets.value.some((preset) => preset.name === name)) {
    return { status: 'existed', message: '' }
  }
  const check = library.createPreset(name, kind)
  if (!check.valid) {
    return { status: 'failed', message: check.message }
  }
  const settings = useAiSettings()
  try {
    const suggestion = await askInstrumentToneAssistant({
      apiKey: settings.apiKey,
      description,
      kind,
      currentKnobs: library.presets.value.find((preset) => preset.name === name)?.knobs ?? {},
      model: settings.soundModel
    })
    library.setPresetKnobs(name, suggestion.knobs)
    return { status: 'ready', message: '' }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}
