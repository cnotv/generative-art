import { describe, expect, it, vi } from 'vitest'
import {
  STRUDEL_AI_DEFAULT_COMPOSE_MODEL,
  STRUDEL_AI_ERRORS,
  STRUDEL_AI_OPENROUTER_URL
} from './config'
import { askOpenRouter, readKnownOpenRouterModel, readOpenRouterJsonAnswer } from './openRouter'

const buildResponseBody = (content: string): unknown => ({ choices: [{ message: { content } }] })

const ask = (fetchImplementation: typeof fetch, apiKey = 'secret-key'): Promise<unknown> =>
  askOpenRouter({ apiKey, body: { model: 'a/b' }, fetchImplementation })

describe('askOpenRouter', () => {
  it('posts the body to OpenRouter with the key in the header only', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(buildResponseBody('{"ok":true}')))
    )

    // Act
    const answer = await ask(mockFetch)

    // Assert
    const [url, init] = mockFetch.mock.calls[0] ?? []
    expect(url).toBe(STRUDEL_AI_OPENROUTER_URL)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret-key')
    expect(String(init?.body)).not.toContain('secret-key')
    expect(answer).toEqual({ ok: true })
  })

  it('asks for a key before calling OpenRouter', async () => {
    // Arrange
    const mockFetch = vi.fn<typeof fetch>()

    // Act and Assert
    await expect(ask(mockFetch, '  ')).rejects.toThrow(STRUDEL_AI_ERRORS.noKey)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    [401, STRUDEL_AI_ERRORS.unauthorised],
    [402, STRUDEL_AI_ERRORS.noCredit],
    [429, STRUDEL_AI_ERRORS.rateLimited],
    [500, `${STRUDEL_AI_ERRORS.other} (500).`]
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
    await expect(ask(mockFetch)).rejects.toThrow(STRUDEL_AI_ERRORS.network)
  })

  it('rejects a body that is not JSON', async () => {
    // Arrange
    const mockFetch = vi.fn(async () => new Response('not json'))

    // Act and Assert
    await expect(ask(mockFetch)).rejects.toThrow(STRUDEL_AI_ERRORS.badAnswer)
  })
})

describe('readOpenRouterJsonAnswer', () => {
  it.each([
    ['text that is not JSON', buildResponseBody('turn it up')],
    ['no choices', {}],
    ['JSON that is not an object', buildResponseBody('[1,2]')]
  ])('rejects %s', (_case, body) => {
    // Act and Assert
    expect(() => readOpenRouterJsonAnswer(body)).toThrow(STRUDEL_AI_ERRORS.badAnswer)
  })
})

describe('readKnownOpenRouterModel', () => {
  it.each([
    ['a listed model', 'google/gemini-3.8-flash', 'google/gemini-3.8-flash'],
    ['nothing stored', null, STRUDEL_AI_DEFAULT_COMPOSE_MODEL],
    ['a model no longer listed', 'someone/old-model', STRUDEL_AI_DEFAULT_COMPOSE_MODEL]
  ])('keeps only a model the dropdown offers: %s', (_case, storedModel, expectedModel) => {
    // Act
    const model = readKnownOpenRouterModel(storedModel, STRUDEL_AI_DEFAULT_COMPOSE_MODEL)

    // Assert
    expect(model).toBe(expectedModel)
  })
})
