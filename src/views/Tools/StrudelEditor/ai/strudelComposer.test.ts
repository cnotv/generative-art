import { describe, expect, it, vi } from 'vitest'
import {
  STRUDEL_AI_ERRORS,
  STRUDEL_COMPOSER_ACTIONS,
  STRUDEL_COMPOSER_SYSTEM_PROMPT
} from './config'
import {
  askStrudelComposer,
  buildStrudelComposerRequest,
  parseStrudelComposerAnswer
} from './strudelComposer'
import type { StrudelComposerAction } from './types'

const REQUEST_OPTIONS = {
  action: 'revise' as const,
  request: 'add a hi-hat',
  currentCode: 'setcpm(30)\n$: s("bd*4")',
  model: 'a/b',
  presetNames: ['stoner', 'garagekit']
}

describe('buildStrudelComposerRequest', () => {
  it('sends the system prompt with the presets, and the task, request and code', () => {
    // Act
    const body = JSON.parse(JSON.stringify(buildStrudelComposerRequest(REQUEST_OPTIONS)))

    // Assert
    expect(body.model).toBe('a/b')
    expect(body.messages[0].content).toContain(STRUDEL_COMPOSER_SYSTEM_PROMPT)
    expect(body.messages[0].content).toContain('stoner, garagekit')
    expect(body.messages[1].content).toContain('add a hi-hat')
    expect(body.messages[1].content).toContain('$: s("bd*4")')
    expect(body.response_format.json_schema.strict).toBe(true)
    expect(body.response_format.json_schema.schema.required).toEqual([
      'explanation',
      'code',
      'instruments'
    ])
    expect(
      body.response_format.json_schema.schema.properties.instruments.items.properties.kind.enum
    ).toEqual(['electric-guitar', 'bass-guitar', 'acoustic-guitar', 'organ', 'drum-kit'])
  })

  it.each(STRUDEL_COMPOSER_ACTIONS.map(({ id, instruction }) => [id, instruction]))(
    'tells the model what %s means',
    (action, instruction) => {
      // Act
      const body = JSON.parse(
        JSON.stringify(
          buildStrudelComposerRequest({
            ...REQUEST_OPTIONS,
            action: action as StrudelComposerAction
          })
        )
      )

      // Assert
      expect(body.messages[1].content).toContain(instruction)
    }
  )

  it('teaches that only double-quoted strings are patterns, with a chord plan that runs', () => {
    // Assert
    expect(STRUDEL_COMPOSER_SYSTEM_PROMPT).toContain('single-quoted string')
    expect(STRUDEL_COMPOSER_SYSTEM_PROMPT).toContain('const chords = "<')
    expect(STRUDEL_COMPOSER_SYSTEM_PROMPT).toContain('chords.rootNotes(2).note()')
  })

  it('teaches how to design an instrument and play it', () => {
    // Assert
    expect(STRUDEL_COMPOSER_SYSTEM_PROMPT).toContain('"instruments"')
    expect(STRUDEL_COMPOSER_SYSTEM_PROMPT).toContain('<name>:chord')
    expect(STRUDEL_COMPOSER_SYSTEM_PROMPT).toContain('<name>_kick')
  })

  it('leaves the preset line out when there are no presets', () => {
    // Act
    const body = JSON.parse(
      JSON.stringify(buildStrudelComposerRequest({ ...REQUEST_OPTIONS, presetNames: [] }))
    )

    // Assert
    expect(body.messages[0].content).toBe(STRUDEL_COMPOSER_SYSTEM_PROMPT)
  })
})

describe('parseStrudelComposerAnswer', () => {
  it('keeps the code and explanation of a composition', () => {
    // Act
    const answer = parseStrudelComposerAnswer('compose', {
      explanation: ' A dub loop. ',
      code: '$: s("bd")'
    })

    // Assert
    expect(answer).toEqual({
      action: 'compose',
      explanation: 'A dub loop.',
      code: '$: s("bd")',
      instruments: []
    })
  })

  it('removes a Markdown fence around the code', () => {
    // Act
    const answer = parseStrudelComposerAnswer('revise', {
      explanation: '',
      code: '```javascript\n$: s("bd")\n```'
    })

    // Assert
    expect(answer.code).toBe('$: s("bd")')
  })

  it('drops any code from a review', () => {
    // Act
    const answer = parseStrudelComposerAnswer('review', {
      explanation: 'Too busy.',
      code: '$: s("bd")'
    })

    // Assert
    expect(answer).toEqual({
      action: 'review',
      explanation: 'Too busy.',
      code: '',
      instruments: []
    })
  })

  it('keeps the designed instruments of a composition, dropping any it cannot use', () => {
    // Act
    const answer = parseStrudelComposerAnswer('compose', {
      explanation: '',
      code: '$: note("a1").s("grit")',
      instruments: [
        { name: ' grit ', kind: 'bass-guitar', description: 'A dirty pick bass' },
        { name: 'harp', kind: 'harp', description: 'Not a kind' },
        { name: 7, kind: 'organ', description: 'No name' }
      ]
    })

    // Assert
    expect(answer.instruments).toEqual([
      { name: 'grit', kind: 'bass-guitar', description: 'A dirty pick bass' }
    ])
  })

  it.each(['review', 'fix'] as const)('designs no instruments in a %s', (action) => {
    // Act
    const answer = parseStrudelComposerAnswer(action, {
      explanation: '',
      code: '$: s("bd")',
      instruments: [{ name: 'grit', kind: 'bass-guitar', description: 'A dirty pick bass' }]
    })

    // Assert
    expect(answer.instruments).toEqual([])
  })

  it.each(['compose', 'revise'] as const)('rejects %s with no code', (action) => {
    // Act and Assert
    expect(() => parseStrudelComposerAnswer(action, { explanation: 'Here', code: ' ' })).toThrow(
      STRUDEL_AI_ERRORS.noCode
    )
  })
})

describe('askStrudelComposer', () => {
  it('posts the request and reads the composed code', async () => {
    // Arrange
    const content = JSON.stringify({ explanation: 'Added hats.', code: '$: s("hh*8")' })
    const mockFetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))
    )

    // Act
    const answer = await askStrudelComposer({
      ...REQUEST_OPTIONS,
      apiKey: 'secret-key',
      fetchImplementation: mockFetch
    })

    // Assert
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body)).model).toBe('a/b')
    expect(answer).toEqual({
      action: 'revise',
      explanation: 'Added hats.',
      code: '$: s("hh*8")',
      instruments: []
    })
  })
})
