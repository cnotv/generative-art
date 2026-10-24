import { describe, it, expect } from 'vitest'
import type { StrudelHint, StrudelHintKind } from '../types'
import { applyStrudelHint } from './applyStrudelHint'

const buildHint = (kind: StrudelHintKind, snippet: string): StrudelHint => ({
  id: kind,
  kind,
  title: 'title',
  reason: 'reason',
  snippet
})

describe('applyStrudelHint', () => {
  it.each([
    {
      name: 'adds the tempo at the top',
      code: 's("bd*4")',
      expected: 'setcps(130/60/4)\ns("bd*4")'
    },
    {
      name: 'adds the tempo under the header comments',
      code: '// techno\n// at night\ns("bd*4")',
      expected: '// techno\n// at night\nsetcps(130/60/4)\ns("bd*4")'
    },
    {
      name: 'replaces the tempo already set',
      code: '// techno\nsetcpm(100/4)\ns("bd*4")',
      expected: '// techno\nsetcps(130/60/4)\ns("bd*4")'
    }
  ])('$name', ({ code, expected }) => {
    // Arrange
    const hint = buildHint('tempo', 'setcps(130/60/4)')

    // Act
    const nextCode = applyStrudelHint(code, hint)

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
    const hint = buildHint('instrument', 's("[~ hh]*4")')

    // Act
    const nextCode = applyStrudelHint(code, hint)

    // Assert
    expect(nextCode).toBe(expected)
  })

  it.each([
    {
      name: 'draws the last block',
      code: '$: s("bd*4")\n$: s("hh*8")',
      expected: '$: s("bd*4")\n$: s("hh*8")._punchcard()'
    },
    {
      name: 'draws a plain pattern written over several lines',
      code: 'stack(\n  s("bd*4")\n)',
      expected: 'stack(\n  s("bd*4")\n)._punchcard()'
    },
    {
      name: 'draws before a trailing semicolon',
      code: 's("bd*4");',
      expected: 's("bd*4")._punchcard();'
    },
    {
      name: 'leaves code with no pattern alone',
      code: '// techno',
      expected: '// techno'
    }
  ])('$name', ({ code, expected }) => {
    // Arrange
    const hint = buildHint('visual', '._punchcard()')

    // Act
    const nextCode = applyStrudelHint(code, hint)

    // Assert
    expect(nextCode).toBe(expected)
  })
})
