import { describe, it, expect } from 'vitest'
import { STRUDEL_MUSIC_STYLES } from '../config'
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
})
