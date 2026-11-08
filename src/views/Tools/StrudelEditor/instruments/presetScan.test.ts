import { describe, expect, it } from 'vitest'
import { INSTRUMENT_BUILT_IN_PRESETS } from './config'
import { findReferencedInstrumentPresets, isInstrumentKind } from './presetScan'

const namesIn = (code: string): string[] =>
  findReferencedInstrumentPresets(code, INSTRUMENT_BUILT_IN_PRESETS).map(({ name }) => name)

describe('findReferencedInstrumentPresets', () => {
  it.each([
    ['a plain sound call', 'note("a1").s("chainsaw_chord")', ['chainsaw']],
    ['mini notation with a modifier', 's("blastkit_kick*4 blastkit_snare")', ['blastkit']],
    [
      'two presets',
      '$: s("garagekit_hatclosed")\n$: note("a0").s("fuzzbass_note")',
      ['fuzzbass', 'garagekit']
    ],
    ['no preset', 's("bd sd")', []],
    ['an articulation the kind lacks', 's("fuzzbass_chord")', []],
    ['a longer name ending in a preset name', 's("deathbass_note")', ['deathbass']],
    ['a bare preset name', 's("chainsaw")', ['chainsaw']],
    ['a bare name with a technique', 's("chainsaw:mute chainsaw:chord")', ['chainsaw']],
    ['a bare name with an index', '.sound("chainsaw:2")', ['chainsaw']],
    ['a bare name in a mini notation choice', 's("<chainsaw stoner:1>")', ['chainsaw', 'stoner']],
    ['a bare name in single quotes', "s('stoner*2')", ['stoner']],
    ['a bare name used as a drum kit sound', 's("blastkit")', []],
    ['a bare name outside a string', '// chainsaw\nchainsaw.foo', []],
    ['a comment naming the preset only', '// the stoner sound\ns("bd")', []]
  ])('finds the presets in %s', (_case, code, expectedNames) => {
    // Arrange
    const patternCode = code

    // Act
    const names = namesIn(patternCode).sort()

    // Assert
    expect(names).toEqual([...expectedNames].sort())
  })

  it('does not match a preset name inside a longer word', () => {
    // Arrange
    const code = 's("mystoner_chord")'

    // Act
    const names = namesIn(code)

    // Assert
    expect(names).toEqual([])
  })
})

describe('isInstrumentKind', () => {
  it.each([
    ['organ', true],
    ['drum-kit', true],
    ['kazoo', false]
  ])('says whether %s is a kind: %s', (text, expected) => {
    // Arrange
    const candidate = text

    // Act
    const result = isInstrumentKind(candidate)

    // Assert
    expect(result).toBe(expected)
  })
})
