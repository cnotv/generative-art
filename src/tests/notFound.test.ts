// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const readPublicFile = (name: string): string =>
  readFileSync(new URL(`../../public/${name}`, import.meta.url), 'utf-8')

const redirectRules = (): string[] =>
  readPublicFile('_redirects')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))

describe('unknown paths', () => {
  it('end the redirect rules with a 404 for anything else', () => {
    // Arrange
    const rules = redirectRules()

    // Act
    const lastRule = rules[rules.length - 1]

    // Assert
    expect(lastRule).toMatch(/^\/\*\s+\/404\.html\s+404$/)
  })

  it('never answer an unknown path with the app shell and a 200', () => {
    // Arrange, Act
    const successRules = redirectRules().filter((rule) => /\s200!?$/.test(rule))

    // Assert
    expect(successRules).toEqual([])
  })

  it('keeps the not-found page out of search results and off third party hosts', () => {
    // Arrange, Act
    const page = readPublicFile('404.html')

    // Assert
    expect(page).toContain('<html lang="en">')
    expect(page).toContain('<meta name="robots" content="noindex" />')
    expect(page).not.toMatch(/https?:\/\/(?!cnotv\.xyz)/)
  })

  it('tells crawlers the crawl rules, with the not-found page left out', () => {
    // Arrange, Act
    const robots = readPublicFile('robots.txt')

    // Assert
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Disallow: /404.html')
  })
})
