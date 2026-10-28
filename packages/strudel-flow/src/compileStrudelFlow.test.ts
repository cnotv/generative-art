import { describe, expect, it } from 'vitest'
import { compileStrudelFlow, getStrudelFlowVisualizerWidgetIds } from './compileStrudelFlow'
import { createStrudelFlowDrumRow, createStrudelFlowNodeData } from './nodeDefaults'
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
  beatsPerMinute = 120,
  extras: { beatsPerCycle?: number; setup?: string } = {}
): ReturnType<typeof compileStrudelFlow> =>
  compileStrudelFlow({
    nodes,
    edges,
    beatsPerMinute,
    beatsPerCycle: extras.beatsPerCycle ?? 4,
    setup: extras.setup ?? ''
  })

const STARTER_PAD = 'n("[7] [5] [3] [1] [3] [2] [6] [3]").scale("C3:major")'
const STARTER_CHORDS = 'n("<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>").scale("C4:major")'

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
        `$: ${STARTER_PAD}.lpf(1500).lpq(1).delay(0.5).delaytime(0.25).delayfeedback(0.4)`
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
    expect(compilation.code).toContain(STARTER_PAD)
    expect(compilation.code).toContain('s("bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~")')
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
    expect(compilation.code).toContain(STARTER_PAD)
    expect(compilation.code).toContain(STARTER_CHORDS)
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
      steps: 16,
      rows: ['bd', 'sd', 'hh'].map((sound) => createStrudelFlowDrumRow(sound)),
      showModifiers: false
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

  it('writes a chord progression with its key and scale', () => {
    // Arrange
    const chords = createNode('chords', {
      kind: 'chords',
      key: 'E',
      octave: 4,
      scaleType: 'minor',
      chordProgression: [0, 5]
    })

    // Act
    const compilation = compile([chords])

    // Assert
    expect(compilation.code).toContain('$: n("<[0,2,4] [5,7,9]>").scale("E4:minor")')
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

  it('skips a silent instrument and keeps the rest of its component', () => {
    // Arrange
    const emptyPad = createNode('pad', {
      kind: 'pad',
      steps: 5,
      mode: 'arp',
      octave: 3,
      key: 'C',
      scaleType: 'major',
      grid: Array.from({ length: 16 }, () => Array<boolean>(8).fill(false)),
      columnModifiers: {}
    })
    const chords = createNode('chords', defaultData('chords'))
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile(
      [emptyPad, chords, filter],
      [createEdge('emptyPad', 'filter'), createEdge('chords', 'filter')]
    )

    // Assert
    expect(compilation.errorMessage).toBeNull()
    expect(compilation.code).not.toContain('[7] [5]')
    expect(compilation.code).toContain(`${STARTER_CHORDS}.lpf(1500).lpq(1)`)
  })

  it('writes the beats per cycle and the setup statements before the blocks', () => {
    // Arrange
    const pad = createNode('pad', defaultData('pad'))

    // Act
    const compilation = compile([pad], [], 90, {
      beatsPerCycle: 3,
      setup: "samples('github:tidalcycles/dirt-samples')"
    })

    // Assert
    expect(compilation.code.split('\n').slice(0, 2)).toEqual([
      'setcpm(90/3)',
      "samples('github:tidalcycles/dirt-samples')"
    ])
  })

  it('plays a voice, a generic effect and a sample line in signal order', () => {
    // Arrange
    const notes = createNode('notes', { kind: 'notes', pattern: 'c3 e3', notation: 'auto' })
    const voice = createNode('voice', { kind: 'voice', sound: 'sawtooth' })
    const effect = createNode('effect', {
      kind: 'effect',
      calls: [{ method: 'jux', argument: 'rev' }]
    })
    const samples = createNode('samples', { kind: 'samples', pattern: 'bd*2 sd' })

    // Act
    const compilation = compile(
      [notes, voice, effect, samples],
      [createEdge('notes', 'voice'), createEdge('voice', 'effect')]
    )

    // Assert
    expect(compilation.code).toContain('$: note("c3 e3").sound("sawtooth").jux(rev)')
    expect(compilation.code).toContain('$: s("bd*2 sd")')
  })

  it.each([
    [[true, false], '$: stack(note("c3").hush(), s("bd"))'],
    [[true, true], '_$: stack(note("c3"), s("bd"))']
  ])('mutes instruments %o as %s', ([notesMuted, samplesMuted], expectedBlock) => {
    // Arrange
    const notes = createNode('notes', {
      kind: 'notes',
      pattern: 'c3',
      notation: 'auto',
      muted: notesMuted
    })
    const samples = createNode('samples', { kind: 'samples', pattern: 'bd', muted: samplesMuted })
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile(
      [notes, samples, filter],
      [createEdge('notes', 'filter'), createEdge('samples', 'filter')]
    )

    // Assert
    expect(compilation.code).toContain(`${expectedBlock}.lpf(1500).lpq(1)`)
  })

  it('keeps an effect on the branch of the only instrument that feeds it', () => {
    // Arrange
    const notes = createNode('notes', { kind: 'notes', pattern: 'c3', notation: 'auto' })
    const voice = createNode('voice', { kind: 'voice', sound: 'triangle' })
    const samples = createNode('samples', { kind: 'samples', pattern: 'bd' })
    const filter = createNode('filter', defaultData('filter'))

    // Act
    const compilation = compile(
      [notes, voice, samples, filter],
      [createEdge('notes', 'voice'), createEdge('voice', 'filter'), createEdge('samples', 'filter')]
    )

    // Assert
    expect(compilation.code).toContain(
      '$: stack(note("c3").sound("triangle"), s("bd")).lpf(1500).lpq(1)'
    )
  })

  it("chains an instrument's own calls before muting it", () => {
    // Arrange
    const notes = createNode('notes', {
      kind: 'notes',
      pattern: 'c3',
      notation: 'auto',
      muted: true,
      calls: [{ method: 'mask', argument: '"1 0"' }]
    })
    const samples = createNode('samples', { kind: 'samples', pattern: 'bd' })

    // Act
    const compilation = compile([notes, samples], [])

    // Assert
    expect(compilation.code).toContain('_$: note("c3").mask("1 0")')
  })
})

describe('getStrudelFlowVisualizerWidgetIds', () => {
  const visualizer = (
    id: string,
    visual: 'scope' | 'pianoroll',
    placement: 'inline' | 'background'
  ): StrudelFlowNode => createNode(id, { kind: 'visualizer', visual, placement, options: '' })

  it('names the canvas each inline visual draws on, counted per visual in code order', () => {
    // Arrange
    const nodes = [
      createNode('notes', { kind: 'notes', pattern: 'c3', notation: 'auto' }),
      createNode('samples', { kind: 'samples', pattern: 'bd' }),
      visualizer('notesScope', 'scope', 'inline'),
      visualizer('samplesScope', 'scope', 'inline'),
      visualizer('sharedRoll', 'pianoroll', 'inline'),
      visualizer('behind', 'scope', 'background'),
      createNode('bass', { kind: 'notes', pattern: 'c2', notation: 'auto' }),
      visualizer('bassScope', 'scope', 'inline')
    ]
    const edges = [
      createEdge('notes', 'notesScope'),
      createEdge('samples', 'samplesScope'),
      createEdge('notesScope', 'sharedRoll'),
      createEdge('samplesScope', 'sharedRoll'),
      createEdge('sharedRoll', 'behind'),
      createEdge('bass', 'bassScope')
    ]

    // Act
    const widgetIds = getStrudelFlowVisualizerWidgetIds(nodes, edges)

    // Assert
    expect(compile(nodes, edges).code).toContain(
      '$: stack(note("c3")._scope(), s("bd")._scope())._pianoroll().scope()\n$: note("c2")._scope()'
    )
    expect(widgetIds).toEqual({
      notesScope: '_widget__scope_0',
      samplesScope: '_widget__scope_1',
      sharedRoll: '_widget__pianoroll_0',
      bassScope: '_widget__scope_2'
    })
  })
})
