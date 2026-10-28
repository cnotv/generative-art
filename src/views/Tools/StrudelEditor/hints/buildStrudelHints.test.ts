import { describe, it, expect } from 'vitest'
import { STRUDEL_MUSIC_STYLES } from '../config'
import type { StrudelHintKind } from '../types'
import { buildStrudelHints } from './buildStrudelHints'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

const technoStyle = STRUDEL_MUSIC_STYLES.find((style) => style.id === 'techno')!

const groupOf = (kind: StrudelHintKind): number => {
  if (kind === 'review') {
    return 0
  }
  return kind === 'idea' ? 2 : 1
}

describe('buildStrudelHints', () => {
  it('lists what to review first, then what is missing, then ideas', () => {
    // Arrange
    const patternCode = 'setcps(130/60/4)\n$: s("bd*4, [~ hh]*4")\n$: chord("<Cm7>").voicing()'

    // Act
    const hintGroups = buildStrudelHints({
      code: patternCode,
      facts: readStrudelCodeFacts(patternCode),
      style: technoStyle
    }).map((hint) => groupOf(hint.kind))

    // Assert
    expect(new Set(hintGroups)).toEqual(new Set([0, 1, 2]))
    expect(hintGroups).toEqual([...hintGroups].sort((first, second) => first - second))
  })
})
