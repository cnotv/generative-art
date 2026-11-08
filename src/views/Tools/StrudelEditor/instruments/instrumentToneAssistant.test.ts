import { describe, expect, it, vi } from 'vitest'
import { STRUDEL_AI_ERRORS, STRUDEL_AI_OPENROUTER_URL } from '../ai/config'
import { INSTRUMENT_BUILT_IN_PRESETS, INSTRUMENT_KINDS, INSTRUMENT_KIND_IDS } from './config'
import {
  askInstrumentToneAssistant,
  buildInstrumentToneRequest,
  buildInstrumentToneSchema,
  parseInstrumentToneAnswer
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

describe('parseInstrumentToneAnswer', () => {
  it('accepts a valid answer for a kind', () => {
    // Act
    const suggestion = parseInstrumentToneAnswer('electric-guitar', GUITAR_ANSWER)

    // Assert
    expect(suggestion.knobs).toEqual({ drive: 0.9, tone: 0.3, bass: 0.8, mids: 0.2, sustain: 0.7 })
    expect(suggestion.explanation).toBe('Scooped and dark.')
  })

  it('reads the knobs of the kind it is asked for', () => {
    // Arrange
    const answer = { tune: 0.2, decay: 0.1, punch: 0.9, drive: 0.4, room: 0, explanation: 'Tight.' }

    // Act
    const suggestion = parseInstrumentToneAnswer('drum-kit', answer)

    // Assert
    expect(Object.keys(suggestion.knobs)).toEqual(['tune', 'decay', 'punch', 'drive', 'room'])
  })

  it('clamps knobs outside 0 to 1', () => {
    // Act
    const { knobs } = parseInstrumentToneAnswer('electric-guitar', {
      ...GUITAR_ANSWER,
      drive: 4,
      bass: -2
    })

    // Assert
    expect([knobs.drive, knobs.bass]).toEqual([1, 0])
  })

  it.each([
    ['a missing knob', { ...GUITAR_ANSWER, mids: undefined }],
    ['a knob of another kind only', { tune: 1, decay: 1 }],
    ['a text knob', { ...GUITAR_ANSWER, tone: 'high' }]
  ])('rejects %s', (_case, answer) => {
    // Arrange
    const parse = (): unknown => parseInstrumentToneAnswer('electric-guitar', answer)

    // Act and Assert
    expect(parse).toThrow(STRUDEL_AI_ERRORS.badAnswer)
  })
})

describe('askInstrumentToneAssistant', () => {
  it('posts the tone request to OpenRouter and reads the knobs from the answer', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(buildResponseBody(JSON.stringify(GUITAR_ANSWER))))
    )

    // Act
    const suggestion = await askInstrumentToneAssistant({
      apiKey: 'secret-key',
      description: 'heavy',
      kind: 'electric-guitar',
      currentKnobs: STONER,
      model: 'a/b',
      fetchImplementation: mockFetch
    })

    // Assert
    const [url, init] = mockFetch.mock.calls[0] ?? []
    expect(url).toBe(STRUDEL_AI_OPENROUTER_URL)
    expect(JSON.parse(String(init?.body)).response_format.json_schema.name).toBe(
      'electric_guitar_knobs'
    )
    expect(suggestion.knobs.drive).toBe(0.9)
  })
})
