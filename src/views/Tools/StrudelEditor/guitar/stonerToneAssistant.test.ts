import { describe, expect, it, vi } from 'vitest'
import {
  STONER_GUITAR_ASSISTANT_ERRORS,
  STONER_GUITAR_DEFAULT_MODEL,
  STONER_GUITAR_DEFAULT_TONE,
  STONER_GUITAR_OPENROUTER_URL
} from './config'
import {
  askStonerToneAssistant,
  buildStonerToneRequest,
  parseStonerToneResponse,
  readKnownStonerToneModel
} from './stonerToneAssistant'

const buildResponseBody = (content: string): unknown => ({ choices: [{ message: { content } }] })

const VALID_ANSWER = {
  drive: 0.9,
  tone: 0.3,
  bass: 0.8,
  mids: 0.2,
  sustain: 0.7,
  explanation: 'Scooped and dark.'
}

describe('buildStonerToneRequest', () => {
  it('carries the model, a strict schema with all five knobs and the description', () => {
    // Arrange
    const options = {
      description: 'dry desert fuzz',
      currentTone: STONER_GUITAR_DEFAULT_TONE,
      model: 'a/b'
    }

    // Act
    const body = JSON.stringify(buildStonerToneRequest(options))

    // Assert
    const parsed = JSON.parse(body)
    expect(parsed.model).toBe('a/b')
    expect(parsed.response_format.type).toBe('json_schema')
    expect(parsed.response_format.json_schema.strict).toBe(true)
    expect(parsed.response_format.json_schema.schema.required).toEqual(
      expect.arrayContaining(['drive', 'tone', 'bass', 'mids', 'sustain', 'explanation'])
    )
    expect(body).toContain('dry desert fuzz')
  })
})

describe('parseStonerToneResponse', () => {
  it('accepts a valid answer', () => {
    // Arrange
    const body = buildResponseBody(JSON.stringify(VALID_ANSWER))

    // Act
    const suggestion = parseStonerToneResponse(body)

    // Assert
    expect(suggestion.tone).toEqual({ drive: 0.9, tone: 0.3, bass: 0.8, mids: 0.2, sustain: 0.7 })
    expect(suggestion.explanation).toBe('Scooped and dark.')
  })

  it('clamps knobs outside 0 to 1', () => {
    // Arrange
    const body = buildResponseBody(JSON.stringify({ ...VALID_ANSWER, drive: 4, bass: -2 }))

    // Act
    const { tone } = parseStonerToneResponse(body)

    // Assert
    expect([tone.drive, tone.bass]).toEqual([1, 0])
  })

  it.each([
    ['a missing knob', buildResponseBody(JSON.stringify({ ...VALID_ANSWER, mids: undefined }))],
    ['a text knob', buildResponseBody(JSON.stringify({ ...VALID_ANSWER, tone: 'high' }))],
    ['text that is not JSON', buildResponseBody('turn it up')],
    ['no choices', {}],
    ['JSON that is not an object', buildResponseBody('[1,2]')]
  ])('rejects %s', (_case, body) => {
    // Arrange
    const parse = (): unknown => parseStonerToneResponse(body)

    // Act and Assert
    expect(parse).toThrow(STONER_GUITAR_ASSISTANT_ERRORS.badAnswer)
  })
})

describe('askStonerToneAssistant', () => {
  const ask = (fetchImplementation: typeof fetch): Promise<unknown> =>
    askStonerToneAssistant({
      apiKey: 'secret-key',
      description: 'heavy',
      currentTone: STONER_GUITAR_DEFAULT_TONE,
      model: 'a/b',
      fetchImplementation
    })

  it('posts to OpenRouter with the key in the header only', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(buildResponseBody(JSON.stringify(VALID_ANSWER))))
    )

    // Act
    await ask(mockFetch)

    // Assert
    const [url, init] = mockFetch.mock.calls[0] ?? []
    expect(url).toBe(STONER_GUITAR_OPENROUTER_URL)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret-key')
    expect(String(init?.body)).not.toContain('secret-key')
  })

  it.each([
    [401, STONER_GUITAR_ASSISTANT_ERRORS.unauthorised],
    [402, STONER_GUITAR_ASSISTANT_ERRORS.noCredit],
    [429, STONER_GUITAR_ASSISTANT_ERRORS.rateLimited],
    [500, `${STONER_GUITAR_ASSISTANT_ERRORS.other} (500).`]
  ])('turns status %i into a readable message', async (status, message) => {
    // Arrange
    const mockFetch = vi.fn(async () => new Response('', { status }))

    // Act and Assert
    await expect(ask(mockFetch)).rejects.toThrow(message)
  })

  it('turns a network failure into a readable message', async () => {
    // Arrange
    const mockFetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    // Act and Assert
    await expect(ask(mockFetch)).rejects.toThrow(STONER_GUITAR_ASSISTANT_ERRORS.network)
  })

  it('rejects a body that is not JSON', async () => {
    // Arrange
    const mockFetch = vi.fn(async () => new Response('not json'))

    // Act and Assert
    await expect(ask(mockFetch)).rejects.toThrow(STONER_GUITAR_ASSISTANT_ERRORS.badAnswer)
  })
})

describe('readKnownStonerToneModel', () => {
  it.each([
    ['a listed model', 'google/gemini-3.8-flash', 'google/gemini-3.8-flash'],
    ['nothing stored', null, STONER_GUITAR_DEFAULT_MODEL],
    ['a model no longer listed', 'someone/old-model', STONER_GUITAR_DEFAULT_MODEL]
  ])('keeps only a model the dropdown offers: %s', (_case, storedModel, expectedModel) => {
    // Arrange, Act
    const model = readKnownStonerToneModel(storedModel)

    // Assert
    expect(model).toBe(expectedModel)
  })
})
