import { describe, it, expect } from 'vitest'
import type { StrudelMusicStyle } from '../types'
import { applyStrudelHint } from './applyStrudelHint'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'
import { buildReviewHints } from './reviewHints'

const breakbeatStyle: StrudelMusicStyle = {
  id: 'breakbeat',
  label: 'Breakbeat',
  keywords: [],
  minBeatsPerMinute: 120,
  maxBeatsPerMinute: 140,
  beatsPerMinute: 130,
  instruments: [
    { role: 'breaks', label: 'a break', snippet: 's("breaks125").fit()', reason: 'break' },
    { role: 'bass', label: 'a bass', snippet: 'note("c2")', reason: 'bass' },
    { role: 'percussion', label: 'percussion', snippet: 's("perc")', reason: 'percussion' }
  ],
  visuals: []
}

const buildHints = (code: string) =>
  buildReviewHints({ code, facts: readStrudelCodeFacts(code), style: breakbeatStyle })

describe('buildReviewHints', () => {
  it.each([
    {
      name: 'removes all but the first of the visuals stacked on one line',
      code: '$: s("breaks125")\n$: s("perc(3,8)")._scope()._punchcard()',
      expected: {
        id: 'review-visuals-2',
        title: 'Keep one visual on line 2',
        actionLabel: 'Remove',
        code: '$: s("breaks125")\n$: s("perc(3,8)")._scope()'
      }
    },
    {
      name: 'mutes a block playing only what the style is not built with',
      code: '$: s("breaks125").fit()\n$: chord("<Cm7>").voicing()',
      expected: {
        id: 'review-off-style-2',
        title: 'Mute the chords on line 2',
        actionLabel: 'Mute',
        code: '$: s("breaks125").fit()\n_$: chord("<Cm7>").voicing()'
      }
    },
    {
      name: 'mutes a block that only doubles an earlier layer',
      code: '$: s("breaks125").fit()\n$: note("c2 eb2")\n$: note("<c2 g1>").s("sine")',
      expected: {
        id: 'review-doubled-3',
        title: 'Mute the second bass on line 3',
        actionLabel: 'Mute',
        code: '$: s("breaks125").fit()\n$: note("c2 eb2")\n_$: note("<c2 g1>").s("sine")'
      }
    }
  ])('$name', ({ code, expected }) => {
    // Arrange
    const [hint] = buildHints(code)

    // Act
    const nextCode = applyStrudelHint(code, hint)

    // Assert
    expect({
      id: hint.id,
      title: hint.title,
      actionLabel: hint.actionLabel,
      code: nextCode
    }).toEqual(expected)
  })

  it.each([
    { name: 'a plain pattern, which has no block to mute', code: 'chord("<Cm7>").voicing()' },
    { name: 'a block that is already muted', code: '$: s("breaks125")\n_$: chord("<Cm7>")' },
    { name: 'a block with one instrument the style uses', code: '$: s("bd, breaks125")' },
    { name: 'layers that each play their own part', code: '$: s("breaks125")\n$: note("c2")' }
  ])('suggests nothing for $name', ({ code }) => {
    // Arrange
    const patternCode = code

    // Act
    const hints = buildHints(patternCode)

    // Assert
    expect(hints).toEqual([])
  })

  it('explains why a muted layer can come back', () => {
    // Arrange
    const patternCode = '$: s("breaks125")\n$: chord("<Cm7>").voicing()'

    // Act
    const [hint] = buildHints(patternCode)

    // Assert
    expect(hint.reason).toBe(
      "Breakbeat isn't usually built with chords. Muting keeps the layer in the code: delete the _ to bring it back."
    )
  })
})
