import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import {
  STRUDEL_AI_DEFAULT_COMPOSE_MODEL,
  STRUDEL_AI_DEFAULT_SOUND_MODEL,
  STRUDEL_AI_ERRORS,
  STRUDEL_AI_STORAGE_KEY_API_KEY,
  STRUDEL_AI_STORAGE_KEY_SOUND_MODEL
} from './config'
import { useAiSettings } from './useAiSettings'
import { useStrudelComposer } from './useStrudelComposer'

const COMPOSED = { explanation: 'A house loop.', code: '$: s("bd*4")' }

const stubOpenRouter = (answer: Record<string, unknown>) => {
  const content = JSON.stringify(answer)
  const mockFetch = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))
  )
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

describe('useAiSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('reads a key and sound model saved by the Instruments tab before they moved', () => {
    // Arrange
    localStorage.setItem(STRUDEL_AI_STORAGE_KEY_API_KEY, 'saved-key')
    localStorage.setItem(STRUDEL_AI_STORAGE_KEY_SOUND_MODEL, 'google/gemini-3.8-flash')

    // Act
    const settings = useAiSettings()

    // Assert
    expect(settings.apiKey).toBe('saved-key')
    expect(settings.soundModel).toBe('google/gemini-3.8-flash')
    expect(settings.composeModel).toBe(STRUDEL_AI_DEFAULT_COMPOSE_MODEL)
  })

  it('keeps the two models apart and forgets the key', async () => {
    // Arrange
    const settings = useAiSettings()
    settings.apiKey = 'typed-key'
    settings.composeModel = 'openai/gpt-5.4-mini'
    await nextTick()

    // Act
    settings.forgetApiKey()
    await nextTick()

    // Assert
    expect(settings.soundModel).toBe(STRUDEL_AI_DEFAULT_SOUND_MODEL)
    expect(localStorage.getItem('strudel-ai-compose-model')).toBe('openai/gpt-5.4-mini')
    expect(localStorage.getItem(STRUDEL_AI_STORAGE_KEY_API_KEY)).toBeNull()
  })
})

describe('useStrudelComposer', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useAiSettings().apiKey = 'secret-key'
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each([
    [true, ['$: s("bd*4")'], true],
    [false, [], false]
  ])(
    'with Auto apply %s, writes the code into the editor only when ticked',
    async (autoApply, expectedApplied, expectedFlag) => {
      // Arrange
      stubOpenRouter(COMPOSED)
      const composer = useStrudelComposer()
      composer.autoApply = autoApply
      composer.request = 'house'
      const applyCode = vi.fn()

      // Act
      await composer.run('compose', '', applyCode)

      // Assert
      expect(applyCode.mock.calls.map(([code]) => code)).toEqual(expectedApplied)
      expect(composer.answer?.code).toBe(COMPOSED.code)
      expect(composer.answerApplied).toBe(expectedFlag)
    }
  )

  it('applies a held answer on request', async () => {
    // Arrange
    stubOpenRouter(COMPOSED)
    const composer = useStrudelComposer()
    const applyCode = vi.fn()
    await composer.run('revise', '$: s("hh")', applyCode)

    // Act
    composer.applyAnswer(applyCode)

    // Assert
    expect(applyCode).toHaveBeenCalledWith(COMPOSED.code)
    expect(composer.answerApplied).toBe(true)
  })

  it('sends the compose model, never the sound model', async () => {
    // Arrange
    const mockFetch = stubOpenRouter(COMPOSED)
    useAiSettings().composeModel = 'qwen/qwen3.8-flash'

    // Act
    await useStrudelComposer().run('compose', '', vi.fn())

    // Assert
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body)).model).toBe('qwen/qwen3.8-flash')
  })

  it('never applies a review and shows its explanation', async () => {
    // Arrange
    stubOpenRouter({ explanation: 'The kick is too loud.', code: '' })
    const composer = useStrudelComposer()
    composer.autoApply = true
    const applyCode = vi.fn()

    // Act
    await composer.run('review', '$: s("bd")', applyCode)

    // Assert
    expect(applyCode).not.toHaveBeenCalled()
    expect(composer.answer?.explanation).toBe('The kick is too loud.')
  })

  it('shows a readable error and is no longer busy when the key is missing', async () => {
    // Arrange
    useAiSettings().apiKey = ''
    const composer = useStrudelComposer()

    // Act
    await composer.run('compose', '', vi.fn())

    // Assert
    expect(composer.errorMessage).toBe(STRUDEL_AI_ERRORS.noKey)
    expect(composer.busyAction).toBeNull()
  })
})
