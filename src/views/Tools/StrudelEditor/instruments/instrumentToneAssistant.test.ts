import { describe, expect, it, vi } from 'vitest'
import {
  INSTRUMENT_ASSISTANT_ERRORS,
  INSTRUMENT_BUILT_IN_PRESETS,
  INSTRUMENT_DEFAULT_MODEL,
  INSTRUMENT_KINDS,
  INSTRUMENT_KIND_IDS,
  INSTRUMENT_OPENROUTER_URL
} from './config'
import {
  askInstrumentToneAssistant,
  buildInstrumentToneRequest,
  buildInstrumentToneSchema,
  parseInstrumentToneResponse,
  readKnownInstrumentToneModel
} from './instrumentToneAssistant'

const buildResponseBody = (content: string): unknown => ({ choices: [{ message: { content } }] })

const GUITAR_ANSWER = {
  drive: 0.9,
  tone: 0.3,
  bass: 0.8,
  mids: 0.2,
  sustain: 0.7,
  explanation: 'Scooped and dark.'
}

const STONER = INSTRUMENT_BUILT_IN_PRESETS[0]?.knobs ?? {}

describe('buildInstrumentToneSchema', () => {
  it.each(INSTRUMENT_KIND_IDS)(
    'lists the knobs of %s plus an explanation, and nothing else',
    (kind) => {
      // Arrange
      const knobIds = INSTRUMENT_KINDS[kind].knobs.map(({ id }) => id)

      // Act
      const schema = buildInstrumentToneSchema(kind)

      // Assert
      expect(schema.required).toEqual([...knobIds, 'explanation'])
      expect(Object.keys(Object(schema.properties))).toEqual([...knobIds, 'explanation'])
      expect(schema.additionalProperties).toBe(false)
    }
  )
})

describe('buildInstrumentToneRequest', () => {
  it.each(INSTRUMENT_KIND_IDS)(
    'carries the prompt and strict schema of %s and the description',
    (kind) => {
      // Arrange
      const options = { description: 'dry desert fuzz', kind, currentKnobs: STONER, model: 'a/b' }

      // Act
      const body = JSON.stringify(buildInstrumentToneRequest(options))

      // Assert
      const parsed = JSON.parse(body)
      expect(parsed.model).toBe('a/b')
      expect(parsed.messages[0].content).toBe(INSTRUMENT_KINDS[kind].assistantPrompt)
      expect(parsed.response_format.json_schema.strict).toBe(true)
      expect(parsed.response_format.json_schema.schema.required).toContain(
        INSTRUMENT_KINDS[kind].knobs[0]?.id
      )
      expect(body).toContain('dry desert fuzz')
    }
  )
})

describe('parseInstrumentToneResponse', () => {
  it('accepts a valid answer for a kind', () => {
    // Arrange
    const body = buildResponseBody(JSON.stringify(GUITAR_ANSWER))

    // Act
    const suggestion = parseInstrumentToneResponse('electric-guitar', body)

    // Assert
    expect(suggestion.knobs).toEqual({ drive: 0.9, tone: 0.3, bass: 0.8, mids: 0.2, sustain: 0.7 })
    expect(suggestion.explanation).toBe('Scooped and dark.')
  })

  it('reads the knobs of the kind it is asked for', () => {
    // Arrange
    const answer = { tune: 0.2, decay: 0.1, punch: 0.9, drive: 0.4, room: 0, explanation: 'Tight.' }

    // Act
    const suggestion = parseInstrumentToneResponse(
      'drum-kit',
      buildResponseBody(JSON.stringify(answer))
    )

    // Assert
    expect(Object.keys(suggestion.knobs)).toEqual(['tune', 'decay', 'punch', 'drive', 'room'])
  })

  it('clamps knobs outside 0 to 1', () => {
    // Arrange
    const body = buildResponseBody(JSON.stringify({ ...GUITAR_ANSWER, drive: 4, bass: -2 }))

    // Act
    const { knobs } = parseInstrumentToneResponse('electric-guitar', body)

    // Assert
    expect([knobs.drive, knobs.bass]).toEqual([1, 0])
  })

  it.each([
    ['a missing knob', buildResponseBody(JSON.stringify({ ...GUITAR_ANSWER, mids: undefined }))],
    ['a knob of another kind only', buildResponseBody(JSON.stringify({ tune: 1, decay: 1 }))],
    ['a text knob', buildResponseBody(JSON.stringify({ ...GUITAR_ANSWER, tone: 'high' }))],
    ['text that is not JSON', buildResponseBody('turn it up')],
    ['no choices', {}],
    ['JSON that is not an object', buildResponseBody('[1,2]')]
  ])('rejects %s', (_case, body) => {
    // Arrange
    const parse = (): unknown => parseInstrumentToneResponse('electric-guitar', body)

    // Act and Assert
    expect(parse).toThrow(INSTRUMENT_ASSISTANT_ERRORS.badAnswer)
  })
})

describe('askInstrumentToneAssistant', () => {
  const ask = (fetchImplementation: typeof fetch): Promise<unknown> =>
    askInstrumentToneAssistant({
      apiKey: 'secret-key',
      description: 'heavy',
      kind: 'electric-guitar',
      currentKnobs: STONER,
      model: 'a/b',
      fetchImplementation
    })

  it('posts to OpenRouter with the key in the header only', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(buildResponseBody(JSON.stringify(GUITAR_ANSWER))))
    )

    // Act
    await ask(mockFetch)

    // Assert
    const [url, init] = mockFetch.mock.calls[0] ?? []
    expect(url).toBe(INSTRUMENT_OPENROUTER_URL)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret-key')
    expect(String(init?.body)).not.toContain('secret-key')
  })

  it.each([
    [401, INSTRUMENT_ASSISTANT_ERRORS.unauthorised],
    [402, INSTRUMENT_ASSISTANT_ERRORS.noCredit],
    [429, INSTRUMENT_ASSISTANT_ERRORS.rateLimited],
    [500, `${INSTRUMENT_ASSISTANT_ERRORS.other} (500).`]
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
    await expect(ask(mockFetch)).rejects.toThrow(INSTRUMENT_ASSISTANT_ERRORS.network)
  })

  it('rejects a body that is not JSON', async () => {
    // Arrange
    const mockFetch = vi.fn(async () => new Response('not json'))

    // Act and Assert
    await expect(ask(mockFetch)).rejects.toThrow(INSTRUMENT_ASSISTANT_ERRORS.badAnswer)
  })
})

describe('readKnownInstrumentToneModel', () => {
  it.each([
    ['a listed model', 'google/gemini-3.8-flash', 'google/gemini-3.8-flash'],
    ['nothing stored', null, INSTRUMENT_DEFAULT_MODEL],
    ['a model no longer listed', 'someone/old-model', INSTRUMENT_DEFAULT_MODEL]
  ])('keeps only a model the dropdown offers: %s', (_case, storedModel, expectedModel) => {
    // Arrange, Act
    const model = readKnownInstrumentToneModel(storedModel)

    // Assert
    expect(model).toBe(expectedModel)
  })
})
