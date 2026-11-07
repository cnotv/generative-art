import { describe, expect, it } from 'vitest'
import { inlineStrudelFlowPatternVariables, readStrudelFlowVariables } from './patternVariables'

describe('inlineStrudelFlowPatternVariables', () => {
  it.each([
    ['a string constant', ['const riffs = "<c3 e3>"'], 'note(riffs)', 'note("<c3 e3>")'],
    ['a constant naming another', ['const a = "c3"', 'const b = a'], 'note(b)', 'note("c3")'],
    [
      'an arrangement of chords and silence',
      ['const drone = arrange([2, silence], [1, "D5"], [1, "C5"])'],
      'chord(drone)',
      'chord("<~!2 D5 C5>")'
    ],
    [
      'an arrangement whose sections are sequences',
      ['const riff = arrange([2, "<c d>"], [1, "a b"])'],
      'note(riff)',
      'note("<c d [a b]>")'
    ],
    [
      'a section that continues where it stopped on the next pass',
      ['const riff = arrange([3, "<a b>"], [1, "c"])'],
      'note(riff)',
      'note("<a b a c b a b c>")'
    ],
    [
      'an arrangement nested in another',
      [
        'const verse = arrange([1, "a"], [1, "b"])',
        'const song = arrange([2, verse], [1, silence])'
      ],
      'note(song)',
      'note("<a b ~>")'
    ],
    [
      'a variable chained into a call',
      ['const fifth = "0,7"'],
      'note("c").add(note(fifth))',
      'note("c").add(note("0,7"))'
    ]
  ])('inlines %s', (_name, setup, expression, expected) => {
    // Arrange
    const variables = readStrudelFlowVariables(setup)

    // Act
    const inlined = inlineStrudelFlowPatternVariables(expression, variables)

    // Assert
    expect(inlined).toBe(expected)
  })

  it.each([
    ['a value built by a function of the song', ['const lead = plan("<a>")'], 'note(lead)'],
    ['an item that lasts several cycles', ['const x = arrange([2, "<a@2>"])'], 'note(x)'],
    ['an alternation inside a step', ['const x = arrange([2, "[<a b> c]"])'], 'note(x)'],
    ['a chord called as a method', ['const changes = "<Am F>"'], 'n("0").chord(changes)'],
    ['an undeclared name', [], 'note(riff)'],
    ['a constant that names itself', ['const a = a'], 'note(a)']
  ])('leaves %s as written', (_name, setup, expression) => {
    // Arrange
    const variables = readStrudelFlowVariables(setup)

    // Act
    const inlined = inlineStrudelFlowPatternVariables(expression, variables)

    // Assert
    expect(inlined).toBe(expression)
  })
})
