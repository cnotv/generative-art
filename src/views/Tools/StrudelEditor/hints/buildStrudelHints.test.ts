import { describe, it, expect } from 'vitest'
import type { StrudelMusicStyle } from '../types'
import { buildStrudelHints } from './buildStrudelHints'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

const technoStyle: StrudelMusicStyle = {
  id: 'techno',
  label: 'Techno',
  keywords: ['techno'],
  minBeatsPerMinute: 125,
  maxBeatsPerMinute: 140,
  beatsPerMinute: 130,
  instruments: [
    { role: 'kick', label: 'a kick', snippet: 's("bd*4")', reason: 'The kick drives it.' },
    { role: 'hihat', label: 'offbeat hi-hats', snippet: 's("[~ hh]*4")', reason: 'Hats lift it.' }
  ],
  visuals: ['punchcard']
}

const summarise = (code: string) =>
  buildStrudelHints({ facts: readStrudelCodeFacts(code), style: technoStyle }).map(
    ({ id, kind, title, snippet }) => ({ id, kind, title, snippet })
  )

describe('buildStrudelHints', () => {
  it.each([
    {
      name: 'no tempo',
      code: 's("bd*4, [~ hh]*4")._punchcard()',
      expectedTitle: 'Set the tempo to 130 BPM'
    },
    {
      name: 'a tempo below the range',
      code: 'setcps(100/60/4)\ns("bd*4, [~ hh]*4")._punchcard()',
      expectedTitle: 'Speed up to 130 BPM'
    },
    {
      name: 'a tempo above the range',
      code: 'setcps(150/60/4)\ns("bd*4, [~ hh]*4")._punchcard()',
      expectedTitle: 'Slow down to 130 BPM'
    }
  ])('suggests the style tempo for $name', ({ code, expectedTitle }) => {
    // Arrange
    const patternCode = code

    // Act
    const hints = summarise(patternCode)

    // Assert
    expect(hints).toEqual([
      { id: 'tempo', kind: 'tempo', title: expectedTitle, snippet: 'setcps(130/60/4)' }
    ])
  })

  it.each([
    { name: 'a tempo in the range', code: 'setcps(128/60/4)\ns("bd*4, [~ hh]*4")._punchcard()' },
    { name: 'a tempo it cannot read', code: 'setcps(slider(.5))\ns("bd*4, [~ hh]*4")._punchcard()' }
  ])('suggests nothing for $name with every instrument and visual', ({ code }) => {
    // Arrange
    const patternCode = code

    // Act
    const hints = summarise(patternCode)

    // Assert
    expect(hints).toEqual([])
  })

  it('suggests the missing instrument and visual, after the tempo', () => {
    // Arrange
    const patternCode = 's("bd*4")'

    // Act
    const hints = summarise(patternCode)

    // Assert
    expect(hints).toEqual([
      {
        id: 'tempo',
        kind: 'tempo',
        title: 'Set the tempo to 130 BPM',
        snippet: 'setcps(130/60/4)'
      },
      {
        id: 'instrument-hihat',
        kind: 'instrument',
        title: 'Add offbeat hi-hats',
        snippet: 's("[~ hh]*4")'
      },
      {
        id: 'visual-punchcard',
        kind: 'visual',
        title: 'Draw a punchcard',
        snippet: '._punchcard()'
      }
    ])
  })

  it('suggests no visual while there is no pattern to draw', () => {
    // Arrange
    const patternCode = '// techno'

    // Act
    const hintIds = summarise(patternCode).map((hint) => hint.id)

    // Assert
    expect(hintIds).toEqual(['tempo', 'instrument-kick', 'instrument-hihat'])
  })

  it('explains every hint', () => {
    // Arrange
    const facts = readStrudelCodeFacts('setcps(100/60/4)\nnote("c4")')

    // Act
    const reasons = buildStrudelHints({ facts, style: technoStyle }).map((hint) => hint.reason)

    // Assert
    expect(reasons).toEqual([
      '100 BPM is slow for Techno, which usually runs at 125 to 140 BPM.',
      'The kick drives it.',
      'Hats lift it.',
      expect.stringContaining('punchcard')
    ])
  })
})
