import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useStrudelHints } from './useStrudelHints'

const setUp = (initialCode: string) => {
  const patternCode = ref(initialCode)
  const hintState = useStrudelHints(patternCode, (nextCode) => {
    patternCode.value = nextCode
  })
  return { patternCode, ...hintState }
}

describe('useStrudelHints', () => {
  it('follows the code: a new first-line comment changes the style and its hints', () => {
    // Arrange
    const { patternCode, styleDetection, hints } = setUp('// techno\ns("bd*4")')

    // Act
    patternCode.value = '// ambient\ns("bd*4")'

    // Assert
    expect(styleDetection.value?.style.id).toBe('ambient')
    expect(hints.value.map((hint) => hint.id)).toContain('instrument-chords')
  })

  it('lets a picked style override the comment until detection is picked again', () => {
    // Arrange
    const { pickStyle, styleDetection } = setUp('// techno\ns("bd*4")')

    // Act
    pickStyle('dub')
    const pickedStyleId = styleDetection.value?.style.id
    pickStyle(null)

    // Assert
    expect(pickedStyleId).toBe('dub')
    expect(styleDetection.value?.style.id).toBe('techno')
  })

  it('writes an applied hint into the code, and the hint goes away', () => {
    // Arrange
    const { patternCode, applyHint, hints } = setUp('// techno\ns("bd*4")')

    // Act
    applyHint('instrument-clap')

    // Assert
    expect(patternCode.value).toBe('// techno\n$: s("bd*4")\n$: s("~ cp ~ cp")')
    expect(hints.value.map((hint) => hint.id)).not.toContain('instrument-clap')
  })

  it('ignores a hint id that is no longer offered', () => {
    // Arrange
    const { patternCode, applyHint } = setUp('// techno\ns("bd*4")')

    // Act
    applyHint('instrument-kick')

    // Assert
    expect(patternCode.value).toBe('// techno\ns("bd*4")')
  })

  it('puts the punchcard on the drums when the chords already draw a pianoroll', () => {
    // Arrange
    const { patternCode, applyHint } = setUp(
      [
        'setcps(124/60/4)',
        '$: s("bd sd, hh*8")',
        '$: s("~ cp ~ cp")',
        '$: note("<c2 c2 eb2 f2>*4").s("sawtooth").lpf(600)',
        '$: chord("<Cm7 Fm7>").voicing().s("triangle").gain(.4)._pianoroll()'
      ].join('\n')
    )

    // Act
    applyHint('visual-punchcard')

    // Assert
    expect(patternCode.value.split('\n').slice(1, 3)).toEqual([
      '$: s("bd sd, hh*8")._punchcard()',
      '$: s("~ cp ~ cp")'
    ])
  })
})
