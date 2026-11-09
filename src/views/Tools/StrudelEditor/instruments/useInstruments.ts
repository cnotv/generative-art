import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { isRecordModule, requireCallable, requireRecordModule } from '../strudelModules'
import { loadStrudelSoundLibrary } from '../strudelSoundLibrary'
import { useAiSettings } from '../ai/useAiSettings'
import { INSTRUMENT_REGENERATE_DELAY_MS, INSTRUMENT_TAG_PREFIX } from './config'
import { askInstrumentToneAssistant } from './instrumentToneAssistant'
import { designInstrumentPreset } from './designPreset'
import { createPresetLibrary } from './presetLibrary'
import { findReferencedInstrumentPresets } from './presetScan'
import { makeNotesEndAtEvent } from './eventLengthNotes'
import { registerInstrument } from './registerInstrument'
import type { StrudelComposerInstrument } from '../ai/types'
import type { InstrumentPreset, InstrumentRenderStatus } from './types'

// One import shared by every caller, so the sound list and a render never load the engine twice.
const webaudioLoad: { promise: Promise<Record<string, unknown>> | null } = { promise: null }

const loadWebaudio = (): Promise<Record<string, unknown>> => {
  webaudioLoad.promise ??= import('@strudel/webaudio')
    .then(requireRecordModule)
    .catch((error: unknown) => {
      webaudioLoad.promise = null
      throw error
    })
  return webaudioLoad.promise
}

const readForeignSoundNames = async (): Promise<string[]> => {
  const webaudioModule = await loadWebaudio()
  const soundMap = requireRecordModule(webaudioModule.soundMap)
  const registrations: unknown = requireCallable(soundMap.get).call(soundMap)
  if (!isRecordModule(registrations)) {
    return []
  }
  return Object.entries(registrations)
    .filter(([, registration]) => {
      const data = isRecordModule(registration) ? registration.data : undefined
      const tag = isRecordModule(data) ? data.tag : undefined
      return !(typeof tag === 'string' && tag.startsWith(`${INSTRUMENT_TAG_PREFIX}:`))
    })
    .map(([soundName]) => soundName)
}

/**
 * The Instruments tab's state: the presets (built in, tweaked and the user's own), which one is
 * selected, what has been rendered and the optional AI assistant. It is a store because the tab
 * and the play and export paths, which are far apart, share one set of presets. Nothing is
 * rendered until a preset is selected or code names one of its sounds.
 */
export const useInstruments = defineStore('instruments', () => {
  const statusByName = ref<Record<string, InstrumentRenderStatus>>({})
  const errorByName = ref<Record<string, string>>({})
  const renderMillisecondsByName = ref<Record<string, number>>({})
  const assistantBusy = ref(false)
  const assistantExplanation = ref('')
  const assistantError = ref('')

  // Renders queue one behind another, so two quick changes never register out of order.
  const renderState: {
    latest: Promise<void>
    timer: ReturnType<typeof setTimeout> | undefined
    renderedKeys: Map<string, string>
  } = { latest: Promise.resolve(), timer: undefined, renderedKeys: new Map() }

  const setStatus = (name: string, status: InstrumentRenderStatus, message = ''): void => {
    statusByName.value = { ...statusByName.value, [name]: status }
    errorByName.value = { ...errorByName.value, [name]: message }
  }

  const renderPreset = async (preset: InstrumentPreset, key: string): Promise<void> => {
    if (renderState.renderedKeys.get(preset.name) === key) {
      return
    }
    setStatus(preset.name, 'rendering')
    const startedAt = performance.now()
    try {
      const webaudioModule = await loadWebaudio()
      await registerInstrument({ samples: requireCallable(webaudioModule.samples), preset })
      makeNotesEndAtEvent(webaudioModule, preset)
      renderState.renderedKeys.set(preset.name, key)
      renderMillisecondsByName.value = {
        ...renderMillisecondsByName.value,
        [preset.name]: Math.round(performance.now() - startedAt)
      }
      setStatus(preset.name, 'ready')
    } catch (error) {
      setStatus(preset.name, 'error', error instanceof Error ? error.message : String(error))
    }
  }

  // Declared before the library, which calls it as soon as a selection moves.
  const library = createPresetLibrary((name) => void ensureRendered(name))
  const { presets, selectedPreset } = library

  /**
   * Renders a preset and registers its sounds, unless the same kind and knobs were already
   * rendered. A failure is recorded, never thrown, so the other sounds keep working.
   * @param name - the preset's name
   * @returns once the sounds are registered or the failure is recorded
   */
  function ensureRendered(name: string): Promise<void> {
    const preset = presets.value.find((candidate) => candidate.name === name)
    if (preset === undefined) {
      return Promise.resolve()
    }
    const snapshot = { ...preset, knobs: { ...preset.knobs } }
    const key = JSON.stringify([snapshot.kind, snapshot.knobs])
    renderState.latest = renderState.latest.then(() => renderPreset(snapshot, key))
    return renderState.latest
  }

  /**
   * Renders every preset the code plays and waits for them, so a pattern never starts before
   * its sounds exist. Presets the code does not name are left alone.
   * @param code - Strudel code about to be played or exported
   * @returns once every referenced preset is rendered or has failed
   */
  const ensureRenderedForCode = async (code: string): Promise<void> => {
    await Promise.all(
      findReferencedInstrumentPresets(code, presets.value).map(({ name }) => ensureRendered(name))
    )
  }

  // Only the selected preset is re-rendered as it is edited; any other waits until code plays it.
  watch(
    () => JSON.stringify(selectedPreset.value),
    () => {
      clearTimeout(renderState.timer)
      renderState.timer = setTimeout(() => {
        const name = selectedPreset.value?.name
        if (name !== undefined) {
          void ensureRendered(name)
        }
      }, INSTRUMENT_REGENERATE_DELAY_MS)
    }
  )

  const selectedStatus = computed<InstrumentRenderStatus>(
    () => statusByName.value[selectedPreset.value?.name ?? ''] ?? 'idle'
  )

  // Strudel's synths and banks register only when its sound library loads, which may not have
  // happened yet, and a name checked before then could hide one of them.
  const refreshForeignSoundNames = async (): Promise<void> => {
    await loadStrudelSoundLibrary().catch(() => undefined)
    library.foreignSoundNames.value = await readForeignSoundNames().catch(
      () => library.foreignSoundNames.value
    )
  }

  const askAssistant = async (description: string): Promise<void> => {
    const preset = selectedPreset.value
    if (preset === undefined) {
      return
    }
    const settings = useAiSettings()
    assistantBusy.value = true
    assistantError.value = ''
    try {
      const suggestion = await askInstrumentToneAssistant({
        apiKey: settings.apiKey,
        description,
        kind: preset.kind,
        currentKnobs: preset.knobs,
        model: settings.soundModel
      })
      library.setKnobs(suggestion.knobs)
      assistantExplanation.value = suggestion.explanation
    } catch (error) {
      assistantError.value = error instanceof Error ? error.message : String(error)
    } finally {
      assistantBusy.value = false
    }
  }

  return {
    presets,
    selectedPreset,
    selectedStatus,
    isSelectedBuiltIn: library.isSelectedBuiltIn,
    statusByName,
    errorByName,
    renderMillisecondsByName,
    assistantBusy,
    assistantExplanation,
    assistantError,
    ensureRendered,
    ensureRenderedForCode,
    refreshForeignSoundNames,
    checkName: library.checkName,
    selectPreset: library.selectPreset,
    setKnob: library.setKnob,
    setKnobs: library.setKnobs,
    resetPreset: library.resetPreset,
    createPreset: library.createPreset,
    duplicatePreset: library.duplicatePreset,
    renamePreset: library.renamePreset,
    deletePreset: library.deletePreset,
    askAssistant,
    designPreset: (instrument: StrudelComposerInstrument) =>
      designInstrumentPreset(library, instrument)
  }
})
