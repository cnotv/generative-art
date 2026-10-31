import { describe, it, expect } from 'vitest'
import { ELECTRO_TUNES, STRUDEL_EXAMPLES, STRUDEL_MUSIC_STYLES } from '../config'
import type { StrudelMusicStyleId } from '../types'
import { detectMusicStyle } from './detectMusicStyle'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

describe('detectMusicStyle', () => {
  it.each([
    {
      name: 'a picked style over the comment',
      code: '// deep house groove\ns("bd*4")',
      pickedStyleId: 'ambient' as StrudelMusicStyleId,
      expected: { styleId: 'ambient', source: 'picker' }
    },
    {
      name: 'the style the comment names',
      code: '// deep house groove\ns("bd*4")',
      pickedStyleId: null,
      expected: { styleId: 'house', source: 'comment' }
    },
    {
      name: 'an abbreviation in the comment',
      code: '// my first DnB tune\ns("bd*4")',
      pickedStyleId: null,
      expected: { styleId: 'drum-and-bass', source: 'comment' }
    },
    {
      name: 'the longest keyword when two styles match',
      code: '// dub techno at night\ns("bd*4")',
      pickedStyleId: null,
      expected: { styleId: 'techno', source: 'comment' }
    },
    {
      name: 'a guess from the tempo and instruments when the comment names no style',
      code: '// late night\nsetcps(174/60/4)\ns("bd ~ ~ bd, ~ sd")',
      pickedStyleId: null,
      expected: { styleId: 'drum-and-bass', source: 'code' }
    },
    {
      name: 'a guess at the default tempo when the code sets none',
      code: 's("bd*4, [~ hh]*4")',
      pickedStyleId: null,
      expected: { styleId: 'house', source: 'code' }
    }
  ])('picks $name', ({ code, pickedStyleId, expected }) => {
    // Arrange
    const facts = readStrudelCodeFacts(code)

    // Act
    const detection = detectMusicStyle({ styles: STRUDEL_MUSIC_STYLES, pickedStyleId, facts })

    // Assert
    expect({ styleId: detection?.style.id, source: detection?.source }).toEqual(expected)
  })

  it.each([
    { name: 'empty code', code: '' },
    { name: 'a comment naming no style over no instruments', code: '// something new' },
    { name: 'a word that only contains a keyword', code: '// a lighthouse\nnote("c4")' }
  ])('finds no style in $name', ({ code }) => {
    // Arrange
    const facts = readStrudelCodeFacts(code)

    // Act
    const detection = detectMusicStyle({ styles: STRUDEL_MUSIC_STYLES, pickedStyleId: null, facts })

    // Assert
    expect(detection).toBeNull()
  })

  it.each([
    { name: 'a bassline at a house tempo', patternId: 'come-as-you-are-riff' },
    { name: 'a melody at a house tempo', patternId: 'megalovania-riff' },
    { name: 'a melody and bass at an ambient tempo', patternId: 'breakfast-in-america' },
    { name: 'chords at a house tempo', patternId: 'pitch-wheel' },
    { name: 'a tempo outside every style', patternId: 'dinofunk' }
  ])('guesses no style from $name', ({ patternId }) => {
    // Arrange
    const patterns = [...STRUDEL_EXAMPLES, ...ELECTRO_TUNES]
    const facts = readStrudelCodeFacts(
      patterns.find((pattern) => pattern.id === patternId)?.code ?? ''
    )

    // Act
    const detection = detectMusicStyle({ styles: STRUDEL_MUSIC_STYLES, pickedStyleId: null, facts })

    // Assert
    expect(detection).toBeNull()
  })

  it.each(STRUDEL_MUSIC_STYLES.map((style) => ({ styleId: style.id, style })))(
    'guesses $styleId from every instrument it is built with, at its tempo',
    ({ styleId, style }) => {
      // Arrange
      const layers = style.instruments.map((instrument) => `$: ${instrument.snippet}`)
      const code = [`setcps(${style.beatsPerMinute}/60/4)`, ...layers].join('\n')

      // Act
      const detection = detectMusicStyle({
        styles: STRUDEL_MUSIC_STYLES,
        pickedStyleId: null,
        facts: readStrudelCodeFacts(code)
      })

      // Assert
      expect(detection?.style.id).toBe(styleId)
    }
  )
})
