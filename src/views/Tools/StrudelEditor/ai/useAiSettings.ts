import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readStored, writeStored } from '../instruments/storage'
import {
  STRUDEL_AI_DEFAULT_COMPOSE_MODEL,
  STRUDEL_AI_DEFAULT_SOUND_MODEL,
  STRUDEL_AI_STORAGE_KEY_API_KEY,
  STRUDEL_AI_STORAGE_KEY_COMPOSE_MODEL,
  STRUDEL_AI_STORAGE_KEY_SOUND_MODEL
} from './config'
import { readKnownOpenRouterModel } from './openRouter'

/**
 * The player's OpenRouter key and the model each AI feature uses, set in the Settings tab and
 * read by the Compose tab and the Instruments tab's AI tone. Everything is kept in this
 * browser's local storage only.
 */
export const useAiSettings = defineStore('strudelAiSettings', () => {
  const apiKey = ref(readStored(STRUDEL_AI_STORAGE_KEY_API_KEY) ?? '')
  const composeModel = ref(
    readKnownOpenRouterModel(
      readStored(STRUDEL_AI_STORAGE_KEY_COMPOSE_MODEL),
      STRUDEL_AI_DEFAULT_COMPOSE_MODEL
    )
  )
  const soundModel = ref(
    readKnownOpenRouterModel(
      readStored(STRUDEL_AI_STORAGE_KEY_SOUND_MODEL),
      STRUDEL_AI_DEFAULT_SOUND_MODEL
    )
  )

  watch(apiKey, (nextKey) => writeStored(STRUDEL_AI_STORAGE_KEY_API_KEY, nextKey || null))
  watch(composeModel, (nextModel) =>
    writeStored(STRUDEL_AI_STORAGE_KEY_COMPOSE_MODEL, nextModel || null)
  )
  watch(soundModel, (nextModel) =>
    writeStored(STRUDEL_AI_STORAGE_KEY_SOUND_MODEL, nextModel || null)
  )

  const forgetApiKey = (): void => {
    apiKey.value = ''
  }

  return { apiKey, composeModel, soundModel, forgetApiKey }
})
