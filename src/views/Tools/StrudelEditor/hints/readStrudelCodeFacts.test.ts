import { describe, it, expect } from 'vitest'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

describe('readStrudelCodeFacts', () => {
  it.each([
    { code: '// deep house groove\ns("bd*4")', expectedComment: 'deep house groove' },
    { code: '/* techno */ s("bd*4")', expectedComment: 'techno' },
    { code: 's("bd*4") // techno', expectedComment: null },
    { code: 's("bd*4")\n// techno', expectedComment: null },
    { code: '', expectedComment: null }
  ])('reads the first-line comment of $code', ({ code, expectedComment }) => {
    // Arrange
    const patternCode = code

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(facts.firstLineComment).toBe(expectedComment)
  })

  it.each([
    { code: 'setcps(124/60/4)\ns("bd*4")', expectedBeatsPerMinute: 124 },
    { code: 'setcpm(130/4)\ns("bd*4")', expectedBeatsPerMinute: 130 },
    { code: 'setcps(0.5)\ns("bd*4")', expectedBeatsPerMinute: 120 },
    { code: 'setcps(slider(0.5))\ns("bd*4")', expectedBeatsPerMinute: null }
  ])('reads the tempo set by $code', ({ code, expectedBeatsPerMinute }) => {
    // Arrange
    const patternCode = code

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(facts.tempo?.beatsPerMinute).toBe(expectedBeatsPerMinute)
    expect(facts.tempo?.statement).toEqual({ from: 0, to: code.indexOf('\n') })
  })

  it('reports no tempo when the code sets none', () => {
    // Arrange
    const patternCode = 's("bd*4")'

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(facts.tempo).toBeNull()
  })

  it.each([
    { code: 's("bd*4, [~ hh]*4, ~ cp")', expectedRoles: ['kick', 'hihat', 'clap'] },
    { code: 's("bd:3 sd:2").bank("tr909")', expectedRoles: ['kick', 'snare'] },
    { code: 'note("c2 eb2").s("sawtooth")', expectedRoles: ['bass'] },
    { code: 's("jvbass(3,8)")', expectedRoles: ['bass'] },
    { code: 'note("c4 e4 g4").s("triangle")', expectedRoles: ['melody'] },
    { code: 'n("0 2 4").scale("C:major")', expectedRoles: ['melody'] },
    { code: 'chord("<Am C>").voicing()', expectedRoles: ['chords'] },
    { code: 'chord("<Am7 G7>").voicing()', expectedRoles: ['chords'] },
    { code: 's("breaks125").fit()', expectedRoles: ['breaks'] },
    { code: 's("perc(3,8), lt")', expectedRoles: ['percussion'] },
    { code: 'const drums = s("bd*4")\nstack(drums, note("c2"))', expectedRoles: ['kick', 'bass'] },
    { code: '// bass and hats\ns("bd*4")', expectedRoles: ['kick'] },
    { code: 'scale("C:harmonic minor")', expectedRoles: ['melody'] }
  ])('finds the instruments in $code', ({ code, expectedRoles }) => {
    // Arrange
    const patternCode = code

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect([...facts.instrumentRoles].sort()).toEqual([...expectedRoles].sort())
  })

  it.each([
    { code: 's("bd*4")._punchcard()', expectedVisuals: ['punchcard'] },
    { code: 'note("c3 e3").pianoroll()', expectedVisuals: ['pianoroll'] },
    { code: '$: s("bd")._scope()\n$: note("c3")._spiral()', expectedVisuals: ['scope', 'spiral'] },
    { code: 's("bd*4")', expectedVisuals: [] }
  ])('finds the visuals drawn by $code', ({ code, expectedVisuals }) => {
    // Arrange
    const patternCode = code

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(facts.visualNames).toEqual(expectedVisuals)
  })

  it('lists the statements that make sound, leaving out tempo and sample loading', () => {
    // Arrange
    const patternCode =
      '// techno\nsetcps(130/60/4)\nsamples("github:x/y")\n$: s("bd*4");\n$: s("hh*8")'

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(facts.usesPatternBlocks).toBe(true)
    expect(facts.patternStatements.map(({ from, to }) => patternCode.slice(from, to))).toEqual([
      '$: s("bd*4")',
      '$: s("hh*8")'
    ])
  })

  it.each([
    { code: '// techno\n// second line\ns("bd*4")', expectedHeader: '// techno\n// second line' },
    { code: 's("bd*4")', expectedHeader: '' }
  ])('ends the header after the leading comments of $code', ({ code, expectedHeader }) => {
    // Arrange
    const patternCode = code

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(patternCode.slice(0, facts.headerEnd)).toBe(expectedHeader)
  })

  it('reads the instruments and visuals of each pattern statement on its own', () => {
    // Arrange
    const patternCode =
      'setcps(124/60/4)\n$: s("bd sd, hh*8")\n$: chord("<Cm7>").voicing()._pianoroll()'

    // Act
    const facts = readStrudelCodeFacts(patternCode)

    // Assert
    expect(
      facts.patternStatements.map(({ instrumentRoles, visualNames }) => ({
        instrumentRoles,
        visualNames
      }))
    ).toEqual([
      { instrumentRoles: ['kick', 'snare', 'hihat'], visualNames: [] },
      { instrumentRoles: ['chords'], visualNames: ['pianoroll'] }
    ])
  })
})
