import { describe, it, expect } from 'vitest'
import { STRUDEL_MUSIC_STYLES } from '../config'
import { applyStrudelHint } from './applyStrudelHint'
import { buildIdeaHints } from './ideaHints'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

const technoStyle = STRUDEL_MUSIC_STYLES.find((style) => style.id === 'techno')!

const buildHints = (code: string) =>
  buildIdeaHints({ code, facts: readStrudelCodeFacts(code), style: technoStyle })

describe('buildIdeaHints', () => {
  it.each([
    {
      name: 'the first three ideas, each on the first layer it suits',
      code: '$: s("bd*4, hh*8")\n$: note("c2 eb2")',
      expectedTitles: [
        'Drop the drums every fourth bar on line 1',
        'Sweep the filter on line 2',
        'Add drum fills on line 1'
      ]
    },
    {
      name: 'ideas a layer does not have yet',
      code: '$: s("bd*4").mask("<1 0>")',
      expectedTitles: ['Add drum fills on line 1']
    },
    {
      name: 'nothing on a layer the style is not built with',
      code: '$: chord("<Cm7>").voicing()',
      expectedTitles: []
    },
    { name: 'nothing without a layer', code: '// techno', expectedTitles: [] }
  ])('offers $name', ({ code, expectedTitles }) => {
    // Arrange
    const patternCode = code

    // Act
    const titles = buildHints(patternCode).map((hint) => hint.title)

    // Assert
    expect(titles).toEqual(expectedTitles)
  })

  it('chains the idea onto its layer', () => {
    // Arrange
    const patternCode = '$: s("bd*4");\n$: note("c3")'
    const [breakdownHint] = buildHints(patternCode)

    // Act
    const nextCode = applyStrudelHint(patternCode, breakdownHint)

    // Assert
    expect(nextCode).toBe('$: s("bd*4").mask("<1 1 1 0>");\n$: note("c3")')
  })
})
