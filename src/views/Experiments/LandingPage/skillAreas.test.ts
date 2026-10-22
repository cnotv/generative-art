import { describe, it, expect } from 'vitest'
import { SKILL_AREAS } from './config'

describe('SKILL_AREAS', () => {
  it('gives every district its own drawer with tools and highlights', () => {
    // Arrange
    const districts = SKILL_AREAS.map(({ district }) => district)

    // Assert
    expect(new Set(districts).size).toBe(districts.length)
    SKILL_AREAS.forEach(({ tools, highlights }) => {
      expect(tools.length).toBeGreaterThan(0)
      expect(highlights.length).toBeGreaterThan(0)
    })
  })
})
