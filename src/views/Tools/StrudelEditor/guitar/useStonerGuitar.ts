import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { isRecordModule, requireCallable, requireRecordModule } from '../strudelModules'
import {
  STONER_GUITAR_DEFAULT_MODEL,
  STONER_GUITAR_DEFAULT_TONE,
  STONER_GUITAR_REGENERATE_DELAY_MS,
  STONER_GUITAR_STORAGE_KEY_API_KEY,
  STONER_GUITAR_STORAGE_KEY_MODEL,
  STONER_GUITAR_STORAGE_KEY_TONE
} from './config'
import { registerStonerGuitar } from './registerStonerGuitar'
import { askStonerToneAssistant, parseToneKnobs } from './stonerToneAssistant'
import type {
  StonerGuitarSampleRegistrar,
  StonerGuitarStatus,
  StonerGuitarTone,
  StonerGuitarToneKnob
} from './types'

// Storage can throw in private windows or with site data blocked; the page works without it.
const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStored = (key: string, value: string | null): void => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // The setting still holds for this visit.
  }
}

const readStoredTone = (): StonerGuitarTone => {
  try {
    const stored: unknown = JSON.parse(readStored(STONER_GUITAR_STORAGE_KEY_TONE) ?? 'null')
    return isRecordModule(stored) ? parseToneKnobs(stored) : { ...STONER_GUITAR_DEFAULT_TONE }
  } catch {
    return { ...STONER_GUITAR_DEFAULT_TONE }
  }
}

/**
 * The Guitar tab's state: the tone, the render status and the optional AI tone assistant. It is
 * a store because the tab and the sound library, which are far apart, share one tone.
 */
export const useStonerGuitar = defineStore('stonerGuitar', () => {
  const tone = ref<StonerGuitarTone>(readStoredTone())
  const status = ref<StonerGuitarStatus>('idle')
  const errorMessage = ref('')
  const apiKey = ref(readStored(STONER_GUITAR_STORAGE_KEY_API_KEY) ?? '')
  const model = ref(readStored(STONER_GUITAR_STORAGE_KEY_MODEL) ?? STONER_GUITAR_DEFAULT_MODEL)
  const assistantBusy = ref(false)
  const assistantExplanation = ref('')
  const assistantError = ref('')

  // Renders queue one behind another, so two quick changes never register out of order.
  const renderQueue: { latest: Promise<void>; timer: ReturnType<typeof setTimeout> | undefined } = {
    latest: Promise.resolve(),
    timer: undefined
  }

  /**
   * Renders the guitar sounds for the current tone and registers them, tracking the status the
   * Guitar tab shows. A failure is recorded, never thrown, so the other sounds keep working.
   * @param samples - superdough's `samples` function
   * @returns once the sounds are registered or the failure is recorded
   */
  const registerSounds = (samples: StonerGuitarSampleRegistrar): Promise<void> => {
    renderQueue.latest = renderQueue.latest.then(async () => {
      status.value = 'rendering'
      try {
        await registerStonerGuitar({ samples, tone: { ...tone.value } })
        status.value = 'ready'
        errorMessage.value = ''
      } catch (error) {
        status.value = 'error'
        errorMessage.value = error instanceof Error ? error.message : String(error)
      }
    })
    return renderQueue.latest
  }

  const regenerateSounds = async (): Promise<void> => {
    const webaudioModule = requireRecordModule(await import('@strudel/webaudio'))
    await registerSounds(requireCallable(webaudioModule.samples))
  }

  watch(
    tone,
    (nextTone) => {
      writeStored(STONER_GUITAR_STORAGE_KEY_TONE, JSON.stringify(nextTone))
      clearTimeout(renderQueue.timer)
      renderQueue.timer = setTimeout(
        () => void regenerateSounds(),
        STONER_GUITAR_REGENERATE_DELAY_MS
      )
    },
    { deep: true }
  )
  watch(apiKey, (nextKey) => writeStored(STONER_GUITAR_STORAGE_KEY_API_KEY, nextKey || null))
  watch(model, (nextModel) => writeStored(STONER_GUITAR_STORAGE_KEY_MODEL, nextModel || null))

  const setKnob = (knob: StonerGuitarToneKnob, value: number): void => {
    tone.value = { ...tone.value, [knob]: value }
  }
  const resetTone = (): void => {
    tone.value = { ...STONER_GUITAR_DEFAULT_TONE }
  }
  const forgetApiKey = (): void => {
    apiKey.value = ''
  }
  const askAssistant = async (description: string): Promise<void> => {
    assistantBusy.value = true
    assistantError.value = ''
    try {
      const suggestion = await askStonerToneAssistant({
        apiKey: apiKey.value,
        description,
        currentTone: tone.value,
        model: model.value
      })
      tone.value = suggestion.tone
      assistantExplanation.value = suggestion.explanation
    } catch (error) {
      assistantError.value = error instanceof Error ? error.message : String(error)
    } finally {
      assistantBusy.value = false
    }
  }

  return {
    tone,
    status,
    errorMessage,
    apiKey,
    model,
    assistantBusy,
    assistantExplanation,
    assistantError,
    registerSounds,
    setKnob,
    resetTone,
    forgetApiKey,
    askAssistant
  }
})
