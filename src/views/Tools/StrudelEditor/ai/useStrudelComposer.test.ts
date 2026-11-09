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
import { useInstruments } from '../instruments/useInstruments'
import { useAiSettings } from './useAiSettings'
import { useStrudelComposer } from './useStrudelComposer'

const COMPOSED = { explanation: 'A house loop.', code: '$: s("bd*4")' }

vi.mock('@strudel/webaudio', () => ({
  samples: vi.fn(),
  registerSound: vi.fn(),
  soundMap: { get: () => ({ sawtooth: { data: { type: 'synth' } } }) }
}))

const BASS_KNOBS = { drive: 0.9, tone: 0.2, attack: 0.7, mids: 0.6, sustain: 0.4 }

const DESIGNED = {
  explanation: 'A bass groove.',
  code: '$: note("a1").s("grit")',
  instruments: [
    { name: 'grit', kind: 'bass-guitar', description: 'A dirty pick bass' },
    { name: 'stoner', kind: 'electric-guitar', description: 'Already there' },
    { name: 'sawtooth', kind: 'organ', description: 'Hides a synth' }
  ]
}

// The compose model and the sound model answer the same endpoint; the schema name tells them apart.
const stubComposeAndTone = () => {
  const mockFetch = vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    const answer =
      body.response_format.json_schema.name === 'strudel_composition'
        ? DESIGNED
        : { ...BASS_KNOBS, explanation: '' }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] })
    )
  })
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

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
    await composer.applyAnswer(applyCode)

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

  it('sends the editor error as the request of a fix, keeping the typed request', async () => {
    // Arrange
    const mockFetch = stubOpenRouter(COMPOSED)
    const composer = useStrudelComposer()
    composer.request = 'house'
    const applyCode = vi.fn()

    // Act
    await composer.run(
      'fix',
      'const plan = [1]\n$: plan.rootNotes(2)',
      applyCode,
      'plan.rootNotes is not a function'
    )

    // Assert
    const userMessage = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body)).messages[1].content
    expect(userMessage).toContain('plan.rootNotes is not a function')
    expect(userMessage).not.toContain('house')
    expect(composer.request).toBe('house')
    expect(composer.answer?.action).toBe('fix')
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

  it('designs the answer instruments before writing the code that plays them', async () => {
    // Arrange
    stubComposeAndTone()
    const composer = useStrudelComposer()
    composer.request = 'a bass groove'
    const applyCode = vi.fn(() =>
      expect(useInstruments().presets.find(({ name }) => name === 'grit')?.knobs).toEqual(
        BASS_KNOBS
      )
    )
    await composer.run('compose', '', applyCode)

    // Act
    await composer.applyAnswer(applyCode)

    // Assert
    expect(applyCode).toHaveBeenCalledWith(DESIGNED.code)
    expect(composer.instrumentResults.map(({ status }) => status)).toEqual([
      'ready',
      'existed',
      'failed'
    ])
    expect(composer.answerApplied).toBe(true)
  })

  it('designs nothing until the answer is applied', async () => {
    // Arrange
    const mockFetch = stubComposeAndTone()
    const composer = useStrudelComposer()
    composer.request = 'a bass groove'

    // Act
    await composer.run('compose', '', vi.fn())

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(composer.instrumentResults).toEqual([])
    expect(useInstruments().presets.map(({ name }) => name)).not.toContain('grit')
  })
})
