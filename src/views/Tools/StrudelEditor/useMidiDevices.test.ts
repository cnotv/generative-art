import { describe, it, expect } from 'vitest'
import { createMidiSnippets } from './useMidiDevices'

describe('createMidiSnippets', () => {
  it('names the detected input and output in the code', () => {
    // Arrange
    const inputName = 'KeyStep 32'
    const outputName = 'Minilogue'

    // Act
    const snippets = createMidiSnippets(inputName, outputName)

    // Assert
    expect(snippets.map((snippet) => snippet.id)).toEqual(['keyboard', 'controller', 'output'])
    expect(snippets[0].code).toContain('midikeys("KeyStep 32")')
    expect(snippets[1].code).toContain('midin("KeyStep 32")')
    expect(snippets[2].code).toContain('.midi("Minilogue")')
  })

  it('falls back to a placeholder device when none is connected', () => {
    // Arrange
    const noDevice = null

    // Act
    const snippets = createMidiSnippets(noDevice, noDevice)

    // Assert
    expect(snippets.every((snippet) => snippet.code.includes('"IAC Driver Bus 1"'))).toBe(true)
  })
})
