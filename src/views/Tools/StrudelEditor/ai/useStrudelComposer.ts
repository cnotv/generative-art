import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readStored, writeStored } from '../instruments/storage'
import { useInstruments } from '../instruments/useInstruments'
import { STRUDEL_AI_STORAGE_KEY_AUTO_APPLY } from './config'
import { askStrudelComposer } from './strudelComposer'
import { useAiSettings } from './useAiSettings'
import type { StrudelComposerAction, StrudelComposerAnswer } from './types'

/**
 * The Compose tab's state. It is a store so an answer that arrives after the drawer moved to
 * another tab is still there, and still applied when Auto apply is on.
 */
export const useStrudelComposer = defineStore('strudelComposer', () => {
  const request = ref('')
  const autoApply = ref(readStored(STRUDEL_AI_STORAGE_KEY_AUTO_APPLY) === 'true')
  const busyAction = ref<StrudelComposerAction | null>(null)
  const answer = ref<StrudelComposerAnswer | null>(null)
  const answerApplied = ref(false)
  const errorMessage = ref('')

  watch(autoApply, (isOn) => writeStored(STRUDEL_AI_STORAGE_KEY_AUTO_APPLY, String(isOn)))

  const applyAnswer = (applyCode: (code: string) => void): void => {
    if (answer.value === null || answer.value.code.length === 0) {
      return
    }
    applyCode(answer.value.code)
    answerApplied.value = true
  }

  /**
   * Sends the request and the current code to the compose model.
   * @param action - compose a new piece, revise the code, review it, or fix an error
   * @param currentCode - the code in the editor
   * @param applyCode - writes code into the editor, called at once when Auto apply is on
   * @param requestText - what to send as the request; a fix sends the editor's error instead of
   * what the player typed, which stays in the field
   */
  const run = async (
    action: StrudelComposerAction,
    currentCode: string,
    applyCode: (code: string) => void,
    requestText = request.value
  ): Promise<void> => {
    const settings = useAiSettings()
    busyAction.value = action
    errorMessage.value = ''
    try {
      answer.value = await askStrudelComposer({
        action,
        request: requestText.trim(),
        currentCode,
        model: settings.composeModel,
        presetNames: useInstruments().presets.map(({ name }) => name),
        apiKey: settings.apiKey
      })
      answerApplied.value = false
      if (autoApply.value) {
        applyAnswer(applyCode)
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      busyAction.value = null
    }
  }

  return { request, autoApply, busyAction, answer, answerApplied, errorMessage, run, applyAnswer }
})
