import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readStored, writeStored } from '../instruments/storage'
import { useInstruments } from '../instruments/useInstruments'
import {
  STRUDEL_AI_STORAGE_KEY_AUTO_APPLY,
  STRUDEL_AI_STORAGE_KEY_DESIGN_INSTRUMENTS
} from './config'
import { askStrudelComposer } from './strudelComposer'
import { useAiSettings } from './useAiSettings'
import type {
  StrudelComposerAction,
  StrudelComposerAnswer,
  StrudelComposerInstrumentResult
} from './types'

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

  // On unless the player turned it off, since it is what lets a piece bring its own sounds.
  const designInstruments = ref(readStored(STRUDEL_AI_STORAGE_KEY_DESIGN_INSTRUMENTS) !== 'false')

  watch(autoApply, (isOn) => writeStored(STRUDEL_AI_STORAGE_KEY_AUTO_APPLY, String(isOn)))
  watch(designInstruments, (isOn) =>
    writeStored(STRUDEL_AI_STORAGE_KEY_DESIGN_INSTRUMENTS, String(isOn))
  )

  // One result for each of the held answer's instruments, filled in while it is applied.
  const instrumentResults = ref<StrudelComposerInstrumentResult[]>([])
  const applying = ref(false)

  const setInstrumentResult = (index: number, result: StrudelComposerInstrumentResult): void => {
    instrumentResults.value = instrumentResults.value.map((current, currentIndex) =>
      currentIndex === index ? result : current
    )
  }

  /**
   * Creates the instruments the answer designed, then writes its code into the editor, so the
   * code never plays a preset that does not exist yet or still has its starting knobs.
   * @param applyCode - writes code into the editor
   * @returns once the instruments are designed and the code is written
   */
  const applyAnswer = async (applyCode: (code: string) => void): Promise<void> => {
    const heldAnswer = answer.value
    if (heldAnswer === null || heldAnswer.code.length === 0 || applying.value) {
      return
    }
    applying.value = true
    instrumentResults.value = heldAnswer.instruments.map(() => ({
      status: 'creating',
      message: ''
    }))
    try {
      const instruments = useInstruments()
      await instruments.refreshForeignSoundNames()
      await Promise.all(
        heldAnswer.instruments.map(async (instrument, index) =>
          setInstrumentResult(index, await instruments.designPreset(instrument))
        )
      )
      applyCode(heldAnswer.code)
      answerApplied.value = true
    } finally {
      applying.value = false
    }
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
        designInstruments: designInstruments.value,
        apiKey: settings.apiKey
      })
      answerApplied.value = false
      instrumentResults.value = []
      if (autoApply.value) {
        await applyAnswer(applyCode)
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      busyAction.value = null
    }
  }

  return {
    request,
    autoApply,
    designInstruments,
    busyAction,
    answer,
    answerApplied,
    instrumentResults,
    applying,
    errorMessage,
    run,
    applyAnswer
  }
})
