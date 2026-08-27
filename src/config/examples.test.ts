import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildExampleUrl, playableExamples } from './examples'

describe('buildExampleUrl', () => {
  it('addresses the starter through the deployment base path', () => {
    // Arrange
    const slug = 'runner-starter'

    // Act
    const url = buildExampleUrl(slug)

    // Assert
    expect(url).toBe(`${import.meta.env.BASE_URL}examples/runner-starter/index.html`)
    expect(url).not.toContain('//examples')
  })
})

describe('playableExamples', () => {
  it.each(playableExamples)('$slug has a page to load', ({ slug }) => {
    // Arrange
    const page = resolve(process.cwd(), 'examples', slug, 'index.html')

    // Act
    const exists = existsSync(page)

    // Assert
    expect(exists).toBe(true)
  })
})
