import { describe, expect, it } from 'vitest'
import { compileStrudelFlow } from './compileStrudelFlow'
import { createStrudelFlowNodeData } from './nodeDefaults'
import type {
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowNodeData,
  StrudelFlowNodeKind
} from './types'

const createNode = (id: string, data: StrudelFlowNodeData): StrudelFlowNode => ({
  id,
  type: 'strudel',
  position: { x: 0, y: 0 },
  data
})

const createEdge = (source: string, target: string): StrudelFlowEdge => ({
  id: `${source}-${target}`,
  source,
  target
})

const defaultData = (kind: StrudelFlowNodeKind): StrudelFlowNodeData =>
  createStrudelFlowNodeData(kind)

const compile = (
  nodes: StrudelFlowNode[],
  edges: StrudelFlowEdge[] = [],
  beatsPerMinute = 120
): ReturnType<typeof compileStrudelFlow> => compileStrudelFlow({ nodes, edges, beatsPerMinute })

describe('compileStrudelFlow', () => {
  it('prints the tempo and one block for an instrument and its effects', () => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))
    const filter = createNode('filter', defaultData('filter'))
    const delay = createNode('delay', defaultData('delay'))

    // Act
    const compilation = compile(
      [pad, filter, delay],
      [createEdge('pad', 'filter'), createEdge('filter', 'delay')]
    )

    // Assert
    expect(compilation.errorMessage).toBeNull()
    expect(compilation.code).toBe(
      [
        'setcpm(120/4)',
        '$: note("<c3 eb3 g3 bb3>").sound("triangle").lpf(1500).lpq(1).delay(0.5).delaytime(0.25).delayfeedback(0.4)'
      ].join('\n')
    )
  })

  it('stacks the instruments of a component before its effects', () => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))
    const beats = createNode('beats', defaultData('beats'))
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile(
      [pad, beats, filter],
      [createEdge('pad', 'filter'), createEdge('beats', 'filter')]
    )

    // Assert
    expect(compilation.errorMessage).toBeNull()
    expect(compilation.code).toContain('$: stack(')
    expect(compilation.code).toContain('note("<c3 eb3 g3 bb3>")')
    expect(compilation.code).toContain('s("bd").struct(')
    expect(compilation.code).toContain(').lpf(1500).lpq(1)')
  })

  it('writes one block per connected component', () => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))
    const chords = createNode('chords', defaultData('chords'))

    // Act
    const compilation = compile([pad, chords])

    // Assert
    expect(compilation.errorMessage).toBeNull()
    expect(compilation.code.match(/^\$: /gm)).toHaveLength(2)
    expect(compilation.code).toContain('note("<c3 eb3 g3 bb3>")')
    expect(compilation.code).toContain('chord("<C^7>")')
  })

  it('refuses a cycle instead of writing a patch that would repeat forever', () => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))
    const filter = createNode('filter', defaultData('filter'))
    const delay = createNode('delay', defaultData('delay'))

    // Act
    const compilation = compile(
      [pad, filter, delay],
      [createEdge('pad', 'filter'), createEdge('filter', 'delay'), createEdge('delay', 'filter')]
    )

    // Assert
    expect(compilation.code).toBe('')
    expect(compilation.errorMessage).toContain('loop')
  })

  it('says what is missing when there is no instrument', () => {
    // Arrange
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile([filter])

    // Assert
    expect(compilation.code).toBe('')
    expect(compilation.errorMessage).toContain('instrument')
  })

  it('says what is missing when every instrument is silent', () => {
    // Arrange
    const beats = createNode('beats', {
      kind: 'beats',
      rows: [
        { instrument: 'bd', steps: Array(16).fill(false) },
        { instrument: 'sd', steps: Array(16).fill(false) },
        { instrument: 'hh', steps: Array(16).fill(false) }
      ]
    })

    // Act
    const compilation = compile([beats])

    // Assert
    expect(compilation.code).toBe('')
    expect(compilation.errorMessage).toContain('drum step')
  })

  it('refuses an edge into an instrument', () => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile([pad, filter], [createEdge('filter', 'pad')])

    // Assert
    expect(compilation.code).toBe('')
    expect(compilation.errorMessage).toContain('instrument')
  })

  it.each([
    [0, 'setcpm(1/4)'],
    [999, 'setcpm(300/4)'],
    [Number.NaN, 'setcpm(120/4)']
  ])('clamps a tempo of %s to %s', (beatsPerMinute, tempoLine) => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))

    // Act
    const compilation = compile([pad], [], beatsPerMinute)

    // Assert
    expect(compilation.code.split('\n')[0]).toBe(tempoLine)
  })

  it('writes a chord node with its root, chord type and voice', () => {
    // Arrange
    const chords = createNode('chords', {
      kind: 'chords',
      root: 'E',
      chordType: '-7',
      sound: 'square'
    })

    // Act
    const compilation = compile([chords])

    // Assert
    expect(compilation.code).toContain('$: chord("<E-7>").voicing().sound("square")')
  })

  it('wraps a custom code node in parentheses so it can span several lines', () => {
    // Arrange
    const code = createNode('code', {
      kind: 'code',
      code: 'n("<0 2 4>").scale("C3:major")\n  .sound("triangle")'
    })

    // Act
    const compilation = compile([code])

    // Assert
    expect(compilation.code).toContain('$: (\nn("<0 2 4>").scale("C3:major")')
    expect(compilation.code).toContain('.sound("triangle")\n)')
  })

  it('skips an instrument with no notes and keeps the rest of its component', () => {
    // Arrange
    const emptyPad = createNode('pad', { kind: 'pad', notes: '   ', sound: 'triangle' })
    const chords = createNode('chords', defaultData('chords'))
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile(
      [emptyPad, chords, filter],
      [createEdge('emptyPad', 'filter'), createEdge('chords', 'filter')]
    )

    // Assert
    expect(compilation.errorMessage).toBeNull()
    expect(compilation.code).not.toContain('note(')
    expect(compilation.code).toContain(
      'chord("<C^7>").voicing().sound("sawtooth").lpf(1500).lpq(1)'
    )
  })
})
