import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildSearchUrl,
  buildRunnerUrl,
  buildRepositoryUrl,
  buildCloneCommand,
  isRepositoryName,
  searchRepositories
} from './githubExampleSearch'

const respondWith = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })

const repositoryPayload = {
  full_name: 'cnotv/generative-art',
  html_url: 'https://github.com/cnotv/generative-art',
  description: 'A toolkit',
  stargazers_count: 12
}

afterEach(() => vi.unstubAllGlobals())

describe('buildSearchUrl', () => {
  it('escapes the query so it cannot break out of the parameter', () => {
    expect(buildSearchUrl('vite starter&per_page=100')).toBe(
      'https://api.github.com/search/repositories?q=vite%20starter%26per_page%3D100&per_page=8'
    )
  })
})

describe('buildRunnerUrl and buildRepositoryUrl', () => {
  it('point at the same repository', () => {
    expect(buildRunnerUrl('cnotv/generative-art')).toBe(
      'https://stackblitz.com/github/cnotv/generative-art'
    )
    expect(buildRepositoryUrl('cnotv/generative-art')).toBe(
      'https://github.com/cnotv/generative-art'
    )
  })
})

describe('buildCloneCommand', () => {
  it('names the directory after the repository, not the owner', () => {
    expect(buildCloneCommand('cnotv/generative-art')).toBe(
      'npx degit cnotv/generative-art generative-art && cd generative-art && pnpm install && pnpm dev'
    )
  })
})

describe('isRepositoryName', () => {
  it.each([
    ['cnotv/generative-art', true],
    ['  cnotv/generative-art  ', true],
    ['my.repo/starter-1', true],
    ['generative-art', false],
    ['cnotv/generative art', false],
    ['https://github.com/cnotv/generative-art', false],
    ['', false]
  ])('reads %j as %s', (candidate, expected) => {
    expect(isRepositoryName(candidate)).toBe(expected)
  })
})

describe('searchRepositories', () => {
  it('maps only the fields it needs off the response', async () => {
    vi.stubGlobal('fetch', respondWith({ items: [repositoryPayload] }))

    const repositories = await searchRepositories('generative')

    expect(repositories).toEqual([
      {
        fullName: 'cnotv/generative-art',
        htmlUrl: 'https://github.com/cnotv/generative-art',
        description: 'A toolkit',
        stars: 12
      }
    ])
  })

  it('defaults a null description and a missing star count', async () => {
    const payload = { ...repositoryPayload, description: null, stargazers_count: undefined }
    vi.stubGlobal('fetch', respondWith({ items: [payload] }))

    const [repository] = await searchRepositories('generative')

    expect(repository).toMatchObject({ description: '', stars: 0 })
  })

  it.each([
    ['entries with no full name', { items: [{ html_url: 'https://github.com/x/y' }] }],
    ['entries that are not objects', { items: ['cnotv/generative-art', null] }],
    ['a payload with no items array', { message: 'Bad credentials' }]
  ])('drops %s', async (_label, payload) => {
    vi.stubGlobal('fetch', respondWith(payload))

    await expect(searchRepositories('generative')).resolves.toEqual([])
  })

  it.each([
    [403, 'GitHub search is rate limited, try again in a minute'],
    [500, 'GitHub search failed with status 500']
  ])('turns a %i into a readable error', async (status, message) => {
    vi.stubGlobal('fetch', respondWith({}, status))

    await expect(searchRepositories('generative')).rejects.toThrow(message)
  })
})
