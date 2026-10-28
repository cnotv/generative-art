import { describe, it, expect } from 'vitest'
import {
  ELECTRO_TUNES,
  STRUDEL_SAMPLE_BANKS,
  DEFAULT_STRUDEL_EXAMPLE_ID,
  STRUDEL_EXAMPLES,
  STRUDEL_LICENSE_NOTE
} from './config'

describe('StrudelEditor config', () => {
  it('ships at least one example pattern', () => {
    // Arrange
    const exampleCount = STRUDEL_EXAMPLES.length

    // Act
    const hasExamples = exampleCount > 0

    // Assert
    expect(hasExamples).toBe(true)
  })

  it.each(STRUDEL_EXAMPLES.map((example) => [example.id, example.label, example.code]))(
    'example "%s" has a label and playable code',
    (_id, label, code) => {
      // Arrange
      const labelText = label as string
      const patternCode = code as string

      // Act
      const hasLabel = labelText.length > 0
      const hasCode = patternCode.length > 0

      // Assert
      expect(hasLabel).toBe(true)
      expect(hasCode).toBe(true)
    }
  )

  it('keeps every example id unique', () => {
    // Arrange
    const exampleIds = STRUDEL_EXAMPLES.map((example) => example.id)

    // Act
    const uniqueIds = new Set(exampleIds)

    // Assert
    expect(uniqueIds.size).toBe(exampleIds.length)
  })

  it('gives every example and tune its own id, since each id is its anchor', () => {
    // Arrange
    const patternIds = [...STRUDEL_EXAMPLES, ...ELECTRO_TUNES].map((pattern) => pattern.id)

    // Act
    const uniqueIds = new Set(patternIds)

    // Assert
    expect(uniqueIds.size).toBe(patternIds.length)
  })

  it('points the default at a shipped example', () => {
    // Arrange
    const defaultId = DEFAULT_STRUDEL_EXAMPLE_ID

    // Act
    const matchesDefault = STRUDEL_EXAMPLES.some((example) => example.id === defaultId)

    // Assert
    expect(matchesDefault).toBe(true)
  })

  it('carries the AGPL isolation note for the deployed build', () => {
    // Arrange
    const licenseNote = STRUDEL_LICENSE_NOTE

    // Act
    const mentionsLicense = licenseNote.includes('AGPL-3.0')

    // Assert
    expect(mentionsLicense).toBe(true)
  })

  it('registers dirt-samples last, so the names it shares stay the kit the examples play', () => {
    // Arrange
    const sampleBanks = STRUDEL_SAMPLE_BANKS

    // Act
    const lastBank = sampleBanks.at(-1)

    // Assert
    expect(lastBank?.manifestUrl).toBe(
      'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json'
    )
  })
})
