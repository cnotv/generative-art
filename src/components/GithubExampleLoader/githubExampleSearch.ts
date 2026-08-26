import type { GithubRepository } from './types'

const GITHUB_SEARCH_ENDPOINT = 'https://api.github.com/search/repositories'
const RESULT_LIMIT = 8
const REPOSITORY_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/
const RATE_LIMITED_STATUS = 403

export const buildSearchUrl = (query: string): string =>
  `${GITHUB_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&per_page=${RESULT_LIMIT}`

/**
 * StackBlitz clones, installs and serves the repository, so a starter can be tried without
 * cloning it locally first. It opens in a tab rather than an iframe here: its WebContainer
 * needs SharedArrayBuffer, a nested document only gets that inside a cross-origin isolated
 * parent, and the embed response carries no COEP of its own, so an isolated parent blocks
 * the frame outright while a plain one refuses to run. CodeSandbox was the other candidate
 * and is not one: its anonymous GitHub import answers 422.
 */
export const buildRunnerUrl = (fullName: string): string =>
  `https://stackblitz.com/github/${fullName}`

/** degit copies the tree without the history, which is what a starter wants. */
export const buildCloneCommand = (fullName: string): string => {
  const projectName = fullName.split('/')[1]
  return `npx degit ${fullName} ${projectName} && cd ${projectName} && pnpm install && pnpm dev`
}

export const buildRepositoryUrl = (fullName: string): string => `https://github.com/${fullName}`

export const isRepositoryName = (candidate: string): boolean =>
  REPOSITORY_NAME_PATTERN.test(candidate.trim())

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRepository = (candidate: unknown): GithubRepository | null => {
  if (!isRecord(candidate)) return null

  const fullName = candidate.full_name
  const htmlUrl = candidate.html_url
  if (typeof fullName !== 'string' || typeof htmlUrl !== 'string') return null

  return {
    fullName,
    htmlUrl,
    description: typeof candidate.description === 'string' ? candidate.description : '',
    stars: typeof candidate.stargazers_count === 'number' ? candidate.stargazers_count : 0
  }
}

export const searchRepositories = async (query: string): Promise<GithubRepository[]> => {
  const response = await fetch(buildSearchUrl(query))

  // Unauthenticated search allows ten requests a minute, and says so with a 403 rather
  // than a 429, so the status alone cannot tell a rate limit from a refusal.
  if (!response.ok) {
    throw new Error(
      response.status === RATE_LIMITED_STATUS
        ? 'GitHub search is rate limited, try again in a minute'
        : `GitHub search failed with status ${response.status}`
    )
  }

  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.items)) return []

  return payload.items
    .map(toRepository)
    .filter((repository): repository is GithubRepository => repository !== null)
}
