import { describe, it, expect } from 'vitest'
import type { StrudelHint, StrudelMusicStyle, StrudelVisualName } from '../types'
import { applyStrudelHint } from './applyStrudelHint'
import { buildStrudelHints } from './buildStrudelHints'
import { readStrudelCodeFacts } from './readStrudelCodeFacts'

const buildStyle = (visuals: StrudelVisualName[]): StrudelMusicStyle => ({
  id: 'techno',
  label: 'Techno',
  keywords: [],
  definingRoles: ['kick'],
  minBeatsPerMinute: 125,
  maxBeatsPerMinute: 140,
  beatsPerMinute: 130,
  instruments: [
    { role: 'kick', label: 'a kick', snippet: 's("bd*4")', reason: 'kick' },
    { role: 'hihat', label: 'hi-hats', snippet: 's("[~ hh]*4")', reason: 'hats' },
    { role: 'melody', label: 'a melody', snippet: 'note("c3 e3")', reason: 'melody' },
    { role: 'bass', label: 'a bass', snippet: 'note("c2")', reason: 'bass' }
  ],
  visuals
})

// Hints carry edits worked out from the code, so they are built from it as the tab does.
const applyOfferedHint = (code: string, hintId: string, visuals: StrudelVisualName[] = []) => {
  const facts = readStrudelCodeFacts(code)
  const hint = buildStrudelHints({ code, facts, style: buildStyle(visuals) }).find(
    (offeredHint) => offeredHint.id === hintId
  )
  return hint === undefined ? code : applyStrudelHint(code, hint)
}

describe('applyStrudelHint', () => {
  it('makes several edits from the end back, so none shifts another', () => {
    // Arrange
    const hint: StrudelHint = {
      id: 'two-edits',
      kind: 'review',
      title: 'title',
      reason: 'reason',
      snippet: '',
      actionLabel: 'Remove',
      edits: [
        { from: 0, to: 0, insert: '_' },
        { from: 9, to: 18, insert: '' }
      ]
    }

    // Act
    const nextCode = applyStrudelHint('$: s("x")._scope()', hint)

    // Assert
    expect(nextCode).toBe('_$: s("x")')
  })

  it.each([
    {
      name: 'adds the tempo at the top',
      code: 's("bd*4, [~ hh]*4")',
      expected: 'setcps(130/60/4)\ns("bd*4, [~ hh]*4")'
    },
    {
      name: 'adds the tempo under the header comments',
      code: '// techno\n// at night\ns("bd*4, [~ hh]*4")',
      expected: '// techno\n// at night\nsetcps(130/60/4)\ns("bd*4, [~ hh]*4")'
    },
    {
      name: 'replaces the tempo already set',
      code: '// techno\nsetcpm(100/4)\ns("bd*4, [~ hh]*4")',
      expected: '// techno\nsetcps(130/60/4)\ns("bd*4, [~ hh]*4")'
    }
  ])('$name', ({ code, expected }) => {
    // Arrange
    const hintId = 'tempo'

    // Act
    const nextCode = applyOfferedHint(code, hintId)

    // Assert
    expect(nextCode).toBe(expected)
  })

  it.each([
    {
      name: 'turns a plain pattern into a block and adds the layer as another',
      code: '// techno\ns("bd*4")',
      expected: '// techno\n$: s("bd*4")\n$: s("[~ hh]*4")'
    },
    {
      name: 'keeps a trailing semicolon inside the block',
      code: 's("bd*4");',
      expected: '$: s("bd*4");\n$: s("[~ hh]*4")'
    },
    {
      name: 'adds a block after the existing blocks',
      code: 'setcps(130/60/4)\n$: s("bd*4")\n',
      expected: 'setcps(130/60/4)\n$: s("bd*4")\n$: s("[~ hh]*4")'
    },
    {
      name: 'adds the layer under a comment with no pattern yet',
      code: '// techno',
      expected: '// techno\n$: s("[~ hh]*4")'
    },
    {
      name: 'starts empty code with the layer',
      code: '',
      expected: '$: s("[~ hh]*4")'
    }
  ])('$name', ({ code, expected }) => {
    // Arrange
    const hintId = 'instrument-hihat'

    // Act
    const nextCode = applyOfferedHint(code, hintId)

    // Assert
    expect(nextCode).toBe(expected)
  })

  it.each([
    {
      name: 'draws a punchcard on the drums, not on the last block',
      code: '$: s("bd*4")\n$: note("c3 e3")',
      visualName: 'punchcard' as StrudelVisualName,
      expected: '$: s("bd*4")._punchcard()\n$: note("c3 e3")'
    },
    {
      name: 'draws a pianoroll on the melody before the bass',
      code: '$: s("bd*4")\n$: note("c2")\n$: note("c3 e3")',
      visualName: 'pianoroll' as StrudelVisualName,
      expected: '$: s("bd*4")\n$: note("c2")\n$: note("c3 e3")._pianoroll()'
    },
    {
      name: 'skips a suitable layer that already draws a visual',
      code: '$: s("bd*4")._scope()\n$: s("hh*8")',
      visualName: 'punchcard' as StrudelVisualName,
      expected: '$: s("bd*4")._scope()\n$: s("hh*8")._punchcard()'
    },
    {
      name: 'draws a plain pattern written over several lines',
      code: 'stack(\n  s("bd*4")\n)',
      visualName: 'punchcard' as StrudelVisualName,
      expected: 'stack(\n  s("bd*4")\n)._punchcard()'
    },
    {
      name: 'draws before a trailing semicolon',
      code: 's("bd*4");',
      visualName: 'punchcard' as StrudelVisualName,
      expected: 's("bd*4")._punchcard();'
    },
    {
      name: 'leaves code with no layer the visual suits alone',
      code: '$: s("bd*4")._scope()\n$: note("c3")',
      visualName: 'punchcard' as StrudelVisualName,
      expected: '$: s("bd*4")._scope()\n$: note("c3")'
    }
  ])('$name', ({ code, visualName, expected }) => {
    // Arrange
    const hintId = `visual-${visualName}`

    // Act
    const nextCode = applyOfferedHint(code, hintId, [visualName])

    // Assert
    expect(nextCode).toBe(expected)
  })
})
