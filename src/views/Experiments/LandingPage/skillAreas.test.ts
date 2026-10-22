import { describe, it, expect } from 'vitest'
import { SKILL_AREAS } from './config'

describe('SKILL_AREAS', () => {
  it('gives every district its own drawer, with each company listed once', () => {
    // Arrange
    const districts = SKILL_AREAS.map(({ district }) => district)

    // Assert
    expect(new Set(districts).size).toBe(districts.length)
    SKILL_AREAS.forEach(({ tools, highlights }) => {
      expect(tools.length).toBeGreaterThan(0)
      expect(highlights.length).toBeGreaterThan(0)
      const companies = highlights.map(({ company }) => company)
      expect(new Set(companies).size).toBe(companies.length)
      highlights.forEach(({ points }) => expect(points.length).toBeGreaterThan(0))
    })
  })
})
